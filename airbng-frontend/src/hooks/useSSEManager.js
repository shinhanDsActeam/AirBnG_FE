import { useState, useEffect, useRef, useCallback } from 'react';
import { getUserProfile } from '../utils/jwtUtil';

const DEL_STORAGE_KEY = 'deletedNotifications';

export const useSSEManager = (memberId) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(null);

    const eventSourceRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const listenersRef = useRef(new Map());
    const connectionStatusCallbacksRef = useRef([]);
    const maxReconnectAttempts = 5;
    const isInitializedRef = useRef(false);
    const connectionTimeoutRef = useRef(null); // 연결 타임아웃 추가

    const processedEventIdsRef = useRef(new Set());

    // memberId 자동 감지
    const profile = getUserProfile();
    const resolvedMemberId = memberId || profile?.id || null;

    const lastProcessedKey = `lastProcessedEventId_${resolvedMemberId}`;
    const lastProcessedRef = useRef(
        Number(localStorage.getItem(lastProcessedKey) || 0)
    );

    console.log('[SSE Hook] memberId param:', memberId);

    // 연결 상태 업데이트
    const updateConnectionStatus = useCallback((connected, error = null) => {
        console.log('[SSE Hook] 연결 상태 변경:', connected, error);
        setIsConnected(connected);
        setConnectionError(error);

        if (typeof document !== 'undefined') {
            const indicator = document.getElementById('connectionIndicator');
            if (indicator) {
                indicator.className = connected ? 'connection-indicator connected' : 'connection-indicator';
                indicator.setAttribute('data-status', connected ? '실시간 알림 연결됨' : '연결 끊김');
            }
        }

        connectionStatusCallbacksRef.current.forEach(callback => {
            try {
                callback(connected);
            } catch (err) {
                console.error('[SSE Hook] 연결 상태 콜백 오류:', err);
            }
        });
    }, []);

    // 알림 이벤트 처리 (SseContext에서 처리하도록 단순화)
    const handleAlarmEvent = useCallback((alarmData) => {
        console.log('[SSE Hook] 알림 이벤트 처리:', alarmData);

        // 기존 이벤트 리스너 실행 (SseContext의 wrappedCallback이 호출됨)
        const alarmListeners = listenersRef.current.get('alarm') || [];
        alarmListeners.forEach((listener, index) => {
            try {
                listener(alarmData);
            } catch (err) {
                console.error('[SSE Hook] 알림 리스너 실행 오류:', err);
            }
        });
    }, []);

    // 연결 해제
    const disconnect = useCallback(() => {
        console.log('[SSE Hook] 연결 해제 중...');

        // 타임아웃 클리어
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        updateConnectionStatus(false);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
    }, [updateConnectionStatus]);

    // 재연결 시도
    const attemptReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;

            console.log(`[SSE Hook] ${delay}ms 후 재연결 시도 ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
            setTimeout(() => {
                if (!isConnected && resolvedMemberId) { // resolvedMemberId 체크 추가
                    disconnect();
                    connect();
                }
            }, delay);
        } else {
            console.error('[SSE Hook] 최대 재연결 시도 초과');
            updateConnectionStatus(false, '최대 재연결 시도 초과');
        }
    }, [isConnected, resolvedMemberId, updateConnectionStatus]);

    // 연결
    const connect = useCallback(() => {
        if (isConnected || isConnecting || !resolvedMemberId) {
            console.log('[SSE Hook] 연결 스킵:', { isConnected, isConnecting, resolvedMemberId });
            return;
        }

        console.log('[SSE Hook] 연결 시도 중... memberId:', resolvedMemberId);
        setIsConnecting(true);
        setConnectionError(null);

        // 연결 타임아웃 설정 (10초)
        connectionTimeoutRef.current = setTimeout(() => {
            console.warn('[SSE Hook] 연결 타임아웃');
            if (isConnecting) {
                disconnect();
                updateConnectionStatus(false, '연결 타임아웃');
                attemptReconnect();
            }
        }, 10000);

        try {
            const baseURL = "https://airbng.shinhanacademy.co.kr" || window.location.origin;
            eventSourceRef.current = new EventSource(`${baseURL}/AirBnG/alarms/reservations/alarms`,{withCredentials:true});

            // 서버에서 보내는 'connect' 이벤트로만 연결 완료 판단
            eventSourceRef.current.addEventListener('connect', (event) => {
                console.log('[SSE Hook] 서버 연결 확인:', event.data);

                // 타임아웃 클리어
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }

                updateConnectionStatus(true);
                reconnectAttemptsRef.current = 0;
                setIsConnecting(false);
            });

            eventSourceRef.current.addEventListener('alarm', (event) => {
                const eventId = event.lastEventId || event.id;
                if (!eventId) return;

                // 중복 체크
                if (processedEventIdsRef.current.has(eventId)) {
                    console.log('[SSE Hook] 중복 알림 무시:', eventId);
                    return;
                }

                // 처리 완료 후 저장
                processedEventIdsRef.current.add(eventId);

                let alarmData;
                try {
                    alarmData = JSON.parse(event.data);
                } catch (e) {
                    console.error('[SSE Hook] 알림 파싱 오류:', e, 'Raw data:', event.data);
                    alarmData = { message: event.data };
                }

                console.log('[SSE Hook] 알림 수신:', alarmData);
                handleAlarmEvent(alarmData);

                // lastProcessed 갱신 (숫자형 ID인 경우)
                const numericId = Number(eventId);
                if (!isNaN(numericId) && numericId > (lastProcessedRef.current || 0)) {
                    lastProcessedRef.current = numericId;
                    localStorage.setItem(lastProcessedKey, String(numericId));
                }
            });


            eventSourceRef.current.onopen = () => {
                console.log('[SSE Hook] HTTP 연결 열림 (아직 서버 준비 대기중)');
            };

            eventSourceRef.current.onerror = (error) => {
                console.error('[SSE Hook] 연결 오류:', error);
                console.log('[SSE Hook] EventSource readyState:', eventSourceRef.current?.readyState);

                // 타임아웃 클리어
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }

                updateConnectionStatus(false, 'SSE 연결 오류');
                setIsConnecting(false);

                // EventSource가 자동으로 재연결을 시도하지 않는 경우에만 수동 재연결
                setTimeout(() => {
                    if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
                        attemptReconnect();
                    }
                }, 1000);
            };

        } catch (error) {
            console.error('[SSE Hook] 연결 설정 오류:', error);

            // 타임아웃 클리어
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }

            updateConnectionStatus(false, 'SSE 연결 설정 오류');
            setIsConnecting(false);
            attemptReconnect();
        }
    }, [isConnected, isConnecting, resolvedMemberId, handleAlarmEvent, attemptReconnect, updateConnectionStatus]);

    // 이벤트 리스너 추가/제거
    const addEventListener = useCallback((eventType, callback) => {
        console.log('[SSE Hook] 이벤트 리스너 추가:', eventType);
        if (!listenersRef.current.has(eventType)) {
            listenersRef.current.set(eventType, []);
        }
        const callbacks = listenersRef.current.get(eventType);
        if (!callbacks.includes(callback)) {
            callbacks.push(callback);
            console.log('[SSE Hook] 리스너 등록 완료, 총 개수:', callbacks.length);
        }
    }, []);

    const removeEventListener = useCallback((eventType, callback) => {
        console.log('[SSE Hook] 이벤트 리스너 제거:', eventType);
        if (listenersRef.current.has(eventType)) {
            const listeners = listenersRef.current.get(eventType);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
                console.log('[SSE Hook] 리스너 제거 완료, 남은 개수:', listeners.length);
            }
        }
    }, []);

    const onConnectionStatusChange = useCallback((callback) => {
        connectionStatusCallbacksRef.current.push(callback);
    }, []);

    const requestNotificationPermission = useCallback(() => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            return Notification.requestPermission();
        }
        return Promise.resolve(typeof window !== 'undefined' ? Notification.permission : 'denied');
    }, []);

    const showNotification = useCallback((title, message, options = {}) => {
        console.log('[SSE Hook] 브라우저 알림 생성:', title, message);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: message,
                icon: options.icon || '/favicon.ico',
                tag: options.tag || 'sse-notification',
                ...options
            });

            if (options.autoClose !== false) {
                setTimeout(() => notification.close(), options.duration || 5000);
            }

            return notification;
        } else {
            console.warn('[SSE Hook] 브라우저 알림 권한이 없거나 지원하지 않음');
        }
        return null;
    }, []);

    // 초기화 및 자동 연결
    useEffect(() => {
        if (isInitializedRef.current) return;
        isInitializedRef.current = true;

        console.log('[SSE Hook] 초기화, resolvedMemberId:', resolvedMemberId);

        // 알림 권한 요청
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('[SSE Hook] 브라우저 알림 권한:', permission);
            });
        }

        if (resolvedMemberId && resolvedMemberId !== 'null' && resolvedMemberId !== '') {
            console.log('[SSE Hook] 자동 연결 시작');
            // 약간의 지연을 두고 연결 (서버 준비 시간 확보)
            setTimeout(() => connect(), 500);
        } else {
            console.warn('[SSE Hook] SSE 비활성화: 로그인하지 않은 사용자');
        }
    }, [resolvedMemberId, connect]);

    // 탭 재활성화 시 자동 재연결
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && !isConnected && resolvedMemberId) {
                console.log('[SSE Hook] 탭 재활성화 - 재연결 시도');
                setTimeout(() => connect(), 1000); // 1초 지연
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
    }, [isConnected, resolvedMemberId, connect]);

    // 언마운트 시 연결 해제
    useEffect(() => {
        return () => {
            console.log('[SSE Hook] 컴포넌트 언마운트 - 연결 해제');
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        isConnecting,
        connectionError,
        memberId: resolvedMemberId,
        connect,
        disconnect,
        addEventListener,
        removeEventListener,
        onConnectionStatusChange,
        requestNotificationPermission,
        showNotification
    };
};

// 삭제된 알림 ID 로딩 - memberId 매개변수 추가
export const loadDeletedIds = (memberId) => {
    try {
        const storageKey = `${DEL_STORAGE_KEY}_${memberId || 'default'}`;
        const data = localStorage.getItem(storageKey);
        if (data) {
            const parsedData = JSON.parse(data);
            // 배열 형식이면 Map으로 변환 (이전 버전 호환성)
            if (Array.isArray(parsedData)) {
                const map = new Map();
                parsedData.forEach(key => map.set(key, Date.now()));
                return map;
            }
            // 객체 형식이면 Map으로 변환
            return new Map(Object.entries(parsedData));
        }
        return new Map();
    } catch (e) {
        console.error('삭제 알림 로딩 실패', e);
        return new Map();
    }
};

// 삭제된 알림 저장 - memberId 매개변수 추가
export const saveDeletedIds = (deletedIdsMap, memberId) => {
    try {
        const storageKey = `${DEL_STORAGE_KEY}_${memberId || 'default'}`;
        const obj = Object.fromEntries(deletedIdsMap);
        localStorage.setItem(storageKey, JSON.stringify(obj));
        console.log('[Storage] 삭제 알림 저장 완료:', obj);
    } catch (e) {
        console.error('삭제 알림 저장 실패', e);
    }
};
