import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { getLockerById } from "../api/lockerApi";
import { getReservationForm } from "../api/reservationApi";
import { checkZzimExists, toggleZzim as toggleZzimApi } from "../api/lockerApi";
import styles from "../styles/pages/lockerDetails.module.css";
import lockeraddress from "../assets/location.svg";
import lockerusername from "../assets/lockeruser.svg";
import lockertel from "../assets/call.svg";
import favicon from "../assets/favicon.svg";
import Header from "../components/Header/Header";
import { Modal, useModal } from "../components/common/ModalUtil";
import { getConversationByPeer, getOrCreateConversation } from "../api/chatApi";
import BsChat from "../assets/messages.svg";

const LockerDetails = () => {
    console.log("LockerDetailsPage 렌더링");
    const { lockerId } = useParams();
    console.log("lockerId:", typeof lockerId);

    const navigate = useNavigate();
    const [lockerDetail, setLockerDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalImageIndex, setModalImageIndex] = useState(0);
    const [isZzimed, setIsZzimed] = useState(false);
    const [isZzimLoading, setIsZzimLoading] = useState(false);
    const [isMyLocker, setIsMyLocker] = useState(false);
    const [userLoading, setUserLoading] = useState(true);

    const { modalState, showError, showLogin, hideModal } = useModal();
    const { user } = useAuth();
    const memberId = user?.id;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // 사용자 정보 로딩 완료 체크
    useEffect(() => {
        const timer = setTimeout(() => {
            setUserLoading(false);
        }, 100);

        return () => clearTimeout(timer);
    }, [user]);

    // bottom-nav 숨기기/보이기 처리
    useEffect(() => {
        const bottomNav = document.querySelector(".bottom-nav");
        if (bottomNav) {
            bottomNav.style.display = "none";
        }

        return () => {
            if (bottomNav) {
                bottomNav.style.display = "";
            }
        };
    }, []);

    const checkIfMyLocker = (keeperId, currentUserId) => {
        console.log("내 보관소 체크:", { keeperId, currentUserId });
        return keeperId && currentUserId && keeperId === currentUserId;
    };

    // 찜 상태 확인 API 호출
    const checkZzimStatus = useCallback(async () => {
        if (!lockerId || !memberId || isMyLocker) return;

        try {
            const response = await checkZzimExists(lockerId, memberId);
            console.log("찜 상태 확인 응답:", response);

            const data = response.data || response;
            if (data.code === 1000) {
                setIsZzimed(data.result);
            }
        } catch (error) {
            console.error("찜 상태 확인 에러:", error);
        }
    }, [lockerId, memberId, isMyLocker]);

    // 찜 토글
    const toggleZzim = async () => {
        if (!lockerId || !memberId || !user) {
            showLogin();
            return;
        }

        if (isZzimLoading) return;

        try {
            setIsZzimLoading(true);
            const response = await toggleZzimApi(lockerId, memberId);
            const data = response.data || response;
            if (data.code === 1000 || data.code === 7000 || data.code === 7001) {
                await checkZzimStatus();
            } else {
                throw new Error(data.message || "찜 처리 중 오류 발생");
            }
        } catch (error) {
            console.error("찜 토글 에러:", error);
            showError("오류", "찜 처리 중 오류가 발생했습니다. \n다시 시도해주세요.");
        } finally {
            setIsZzimLoading(false);
        }
    };

    // 예약 버튼 클릭
    const handleReserveClick = async () => {
        if (!lockerId || !memberId || !user) {
            showLogin();
            return;
        }

        if (isMyLocker) return;

        try {
            await getReservationForm(lockerId);
            window.location.href = `/page/reservations/form?lockerId=${lockerId}`;
        } catch (error) {
            console.error("예약 폼 API 호출 에러:", error);
            window.location.href = `/page/reservations/form?lockerId=${lockerId}`;
        }
    };

    useEffect(() => {
        if (!lockerId) {
            setError("보관소가 존재하지 않습니다.");
            setLoading(false);
            return;
        }

        const loadLockerDetails = async (id) => {
            try {
                setLoading(true);
                setError(null);

                console.log("API 호출 시작 - lockerId:", id);
                const response = await getLockerById(id);
                console.log("API 응답 전체:", response);

                let apiData;
                if (response.data) {
                    apiData = response.data;
                    console.log("axios 응답 데이터:", apiData);
                } else if (response.code) {
                    apiData = response;
                    console.log("직접 응답 데이터:", apiData);
                } else {
                    throw new Error("예상하지 못한 응답 형식입니다.");
                }

                if (apiData.code === 1000 && apiData.result) {
                    console.log("보관소 상세 데이터:", apiData.result);
                    console.log("짐 타입 데이터:", apiData.result.jimTypeResults);

                    setLockerDetail(apiData.result);

                    setCurrentImageIndex(0);
                    setModalImageIndex(0);

                    sessionStorage.setItem(
                        `lockerData_${apiData.result.lockerId}`,
                        JSON.stringify({
                            lockerImage: apiData.result.images?.[0] || "",
                            lockerName: apiData.result.lockerName,
                            address: apiData.result.address,
                            addressDetail: apiData.result.addressDetail,
                            keeperId: apiData.result.keeperId,
                            isMyLocker: checkIfMyLocker(apiData.result.keeperId, memberId),
                        })
                    );
                } else {
                    console.error("API 응답 오류:", apiData);
                    throw new Error(
                        apiData.message || "보관소 정보를 불러오는데 실패했습니다."
                    );
                }
            } catch (err) {
                console.error("API 호출 에러:", err);
                setError("보관소가 존재하지 않습니다.");
            } finally {
                setLoading(false);
            }
        };

        loadLockerDetails(lockerId);
    }, [lockerId, memberId]);

    // 내 보관소 체크 로직
    useEffect(() => {
        if (!userLoading && lockerDetail && lockerDetail.keeperId) {
            const myLockerStatus = checkIfMyLocker(lockerDetail.keeperId, memberId);
            console.log("내 보관소 상태 업데이트:", myLockerStatus);
            setIsMyLocker(myLockerStatus);
        }
    }, [lockerDetail, memberId, userLoading]);

    // 보관소 상세 정보 로딩 완료 후 찜 상태 확인
    useEffect(() => {
        if (lockerDetail && memberId) {
            checkZzimStatus();
        }
    }, [lockerDetail, memberId, checkZzimStatus]);

    const formatPhoneNumber = (phone) => {
        if (!phone) return "";
        const numbers = phone.replace(/\D/g, "");
        if (numbers.length === 11)
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(
                7,
                11
            )}`;
        if (numbers.length === 10)
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(
                6,
                10
            )}`;
        return phone;
    };

    // 이미지 처리 헬퍼 함수
    const getDisplayImages = () => {
        if (lockerDetail?.images && lockerDetail.images.length > 0) {
            const sortedImages = [...lockerDetail.images].sort((a, b) => {
                const aStr = String(a || "");
                const bStr = String(b || "");
                return aStr.localeCompare(bStr);
            });
            return sortedImages.slice(0, 5);
        }
        return [favicon];
    };

    // 이미지 슬라이더 관련 함수들
    const nextImage = () => {
        const images = getDisplayImages();
        if (images.length > 1) {
            setCurrentImageIndex((prev) =>
                prev === images.length - 1 ? 0 : prev + 1
            );
        }
    };

    const prevImage = () => {
        const images = getDisplayImages();
        if (images.length > 1) {
            setCurrentImageIndex((prev) =>
                prev === 0 ? images.length - 1 : prev - 1
            );
        }
    };

    const openModal = (index) => {
        setModalImageIndex(index);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setCurrentImageIndex(modalImageIndex);
        setIsModalOpen(false);
    };

    const nextModalImage = () => {
        const images = getDisplayImages();
        if (images.length > 1) {
            setModalImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
        }
    };

    const prevModalImage = () => {
        const images = getDisplayImages();
        if (images.length > 1) {
            setModalImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
        }
    };

    // 이미지 갤러리 렌더링
    const renderImageGallery = () => {
        const images = getDisplayImages();

        return (
            <div className={styles.imageSliderContainer}>
                <div className={styles.imageSlider}>
                    <div
                        className={styles.imageTrack}
                        style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                    >
                        {images.map((img, idx) => (
                            <div key={idx} className={styles.imageSlide}>
                                <img
                                    src={img}
                                    alt={`보관소 이미지 ${idx + 1}`}
                                    className={styles.sliderImage}
                                    onClick={() => openModal(idx)}
                                    onError={(e) => {
                                        if (e.target.src !== favicon) {
                                            e.target.src = favicon;
                                        }
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    {images.length > 1 && (
                        <>
                            <button
                                className={`${styles.sliderBtn} ${styles.prev}`}
                                onClick={prevImage}
                            >
                                &#8249;
                            </button>
                            <button
                                className={`${styles.sliderBtn} ${styles.next}`}
                                onClick={nextImage}
                            >
                                &#8250;
                            </button>
                        </>
                    )}

                    {images.length > 1 && (
                        <div className={styles.sliderIndicators}>
                            {images.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`${styles.indicator} ${
                                        idx === currentImageIndex ? styles.active : ""
                                    }`}
                                    onClick={() => setCurrentImageIndex(idx)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 이미지 모달 렌더링
    const renderImageModal = () => {
        if (!isModalOpen) return null;

        const images = getDisplayImages();

        return (
            <div className={styles.imageModalOverlay} onClick={closeModal}>
                <div
                    className={styles.imageModalContent}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={styles.modalImageContainer}>
                        <button className={styles.modalCloseBtn} onClick={closeModal}>
                            ✕
                        </button>

                        <img
                            src={images[modalImageIndex]}
                            alt={`보관소 이미지 ${modalImageIndex + 1}`}
                            className={styles.modalImage}
                            style={
                                images[modalImageIndex] === favicon
                                    ? {
                                        width: "30%",
                                        height: "30%",
                                        objectFit: "contain",
                                        margin: "auto",
                                    }
                                    : {}
                            }
                            onError={(e) => {
                                if (e.target.src !== favicon) {
                                    e.target.src = favicon;
                                    e.target.style.width = "30%";
                                    e.target.style.height = "30%";
                                    e.target.style.objectFit = "contain";
                                    e.target.style.margin = "auto";
                                }
                            }}
                        />

                        {images.length > 1 && (
                            <>
                                <button
                                    className={`${styles.modalSliderBtn} ${styles.prev}`}
                                    onClick={prevModalImage}
                                >
                                    &#8249;
                                </button>
                                <button
                                    className={`${styles.modalSliderBtn} ${styles.next}`}
                                    onClick={nextModalImage}
                                >
                                    &#8250;
                                </button>
                            </>
                        )}
                    </div>

                    {images.length > 1 && (
                        <div className={styles.modalIndicators}>
                            {images.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`${styles.modalIndicator} ${
                                        idx === modalImageIndex ? styles.active : ""
                                    }`}
                                    onClick={() => setModalImageIndex(idx)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderPriceInfo = () => {
        console.log(
            "renderPriceInfo 호출 - jimTypeResults:",
            lockerDetail?.jimTypeResults
        );

        if (
            !lockerDetail?.jimTypeResults ||
            !Array.isArray(lockerDetail.jimTypeResults) ||
            lockerDetail.jimTypeResults.length === 0
        ) {
            console.log("짐 타입 데이터가 없습니다:", lockerDetail?.jimTypeResults);
            return (
                <div className={styles.priceSection}>
                    <div className={styles.priceTitle}>가격</div>
                    <div className={styles.priceItems}>
                        <div className={styles.priceItemRow}>
                            <span className={styles.priceType}>정보 없음</span>
                            <span className={styles.priceAmount}>
                가격 정보를 확인할 수 없습니다
              </span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={styles.priceSection}>
                <div className={styles.priceTitle}>가격</div>
                <div className={styles.priceItems}>
                    {lockerDetail.jimTypeResults
                        .filter((type) => type && type.typeName && type.pricePerHour)
                        .map((type, index) => (
                            <div key={index} className={styles.priceItemRow}>
                                <span className={styles.priceType}>{type.typeName}</span>
                                <span className={styles.priceAmount}>
                  {type.pricePerHour.toLocaleString()}원/시간당
                </span>
                            </div>
                        ))}
                </div>
            </div>
        );
    };

    const renderLockerInfo = () => {
        if (!lockerDetail) return null;
        const fullAddress = `${lockerDetail.address} ${
            lockerDetail.addressDetail || ""
        }`.trim();

        return (
            <div className={styles.infoSection}>
                <div className={styles.infoRow}>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <img src={lockeraddress} alt="주소" />
                        </div>
                        <div className={styles.infoContent}>
                            <span className={styles.infoLabel}>주소</span>
                            <span className={styles.infoValue}>{fullAddress}</span>
                        </div>
                    </div>
                </div>

                <div className={styles.infoRow}>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <img src={lockerusername} alt="호스트" />
                        </div>
                        <div className={styles.infoContent}>
                            <span className={styles.infoLabel}>호스트</span>
                            <span className={styles.infoValue}>
                {lockerDetail.keeperName}
              </span>
                        </div>
                    </div>
                </div>

                <div className={styles.infoRow}>
                    <div className={styles.infoItem}>
                        <div className={styles.infoIcon}>
                            <img src={lockertel} alt="전화번호" />
                        </div>
                        <div className={styles.infoContent}>
                            <span className={styles.infoLabel}>전화번호</span>
                            <span className={styles.infoValue}>
                {formatPhoneNumber(lockerDetail.keeperPhone)}
              </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const Loader = ({ message, isError }) => (
        <div className={styles.container}>
            <Header
                headerTitle="보관소 상세"
                showBackButton={true}
            />
            <div className={styles.content}>
                <div className={isError ? styles.error : styles.loading}>{message}</div>
            </div>
        </div>
    );

    if (loading || userLoading)
        return <Loader message="보관소 정보를 불러오는 중..." />;
    if (error) return <Loader message={error} isError />;
    if (!lockerDetail)
        return <Loader message="보관소 정보를 찾을 수 없습니다." isError />;

    const isAvailable = lockerDetail.isAvailable !== "NO";

    return (
        <div className={styles.lockerDetailsContainer}>
            <Header headerTitle="보관소 상세" showBackButton={true} />
            <div className={styles.content}>
                {renderImageGallery()}
                <div className={styles.lockerTitle}>{lockerDetail.lockerName}</div>
                {renderLockerInfo()}
                {renderPriceInfo()}
            </div>

            <div className={styles.bottomSection}>
                <div className={styles.bottomButtons}>
                    <button
                        className={`${styles.zzimBtn} ${isZzimed ? styles.active : ""} ${
                            isZzimLoading ? styles.loading : ""
                        } ${isMyLocker ? styles.disabled : ""}`}
                        onClick={toggleZzim}
                        disabled={isZzimLoading || isMyLocker}
                        aria-label={isZzimed ? "찜 취소" : "찜 하기"}
                    >
                        {isZzimLoading ? (
                            <div className={styles.zzimLoader}></div>
                        ) : (
                            <svg
                                className={styles.heartIcon}
                                viewBox="0 0 24 24"
                                fill={isZzimed ? "#ff6b6b" : "none"}
                                stroke={isZzimed ? "#ff6b6b" : "#666"}
                                strokeWidth="2"
                            >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                        )}
                    </button>
                    <button
                        className={styles.chatGoBtn}
                        onClick={async () => {
                            if (!lockerDetail?.keeperId || isMyLocker) return;
                            try {
                                let convId;
                                const res = await getConversationByPeer(lockerDetail.keeperId);
                                console.log("getConversationByPeer result:", res);
                                convId = res?.id || res?.convId || res?.data?.result?.convId;
                                if (!convId) {
                                    const createRes = await getOrCreateConversation(
                                        lockerDetail.keeperId
                                    );
                                    console.log("getOrCreateConversation result:", createRes);
                                    convId =
                                        createRes?.id ||
                                        createRes?.convId ||
                                        createRes?.data?.result?.convId;
                                }
                                if (convId) {
                                    navigate(`/page/chat/${convId}`);
                                } else {
                                    showError("채팅 오류", "대화방을 찾거나 생성할 수 없습니다.");
                                }
                            } catch (e) {
                                showError("채팅 오류", "대화방을 찾거나 생성할 수 없습니다.");
                            }
                        }}
                        disabled={isMyLocker}
                        aria-label="채팅하기"
                    >
                        <img src={BsChat} className={styles.chatIcon} alt="채팅" width={22} height={22} />
                    </button>
                    <button
                        className={`${styles.reserveBtn} ${
                            !isAvailable || isMyLocker ? styles.disabled : ""
                        }`}
                        onClick={handleReserveClick}
                        disabled={!isAvailable || isMyLocker}
                    >
                        {isMyLocker
                            ? "내 보관소 선택 불가"
                            : isAvailable
                                ? "보관소 선택"
                                : "이용 불가"}
                    </button>
                </div>
            </div>

            {/* ModalUtil Modal */}
            <Modal
                show={modalState.show}
                type={modalState.type}
                title={modalState.title}
                message={modalState.message}
                confirmText={modalState.confirmText}
                cancelText={modalState.cancelText}
                showCancel={modalState.showCancel}
                onConfirm={modalState.onConfirm}
                onCancel={modalState.onCancel}
                onClose={hideModal}
            />

            {/* 이미지 모달 - 최상위 레벨로 이동 */}
            {renderImageModal()}
        </div>
    );
};

export default LockerDetails;
