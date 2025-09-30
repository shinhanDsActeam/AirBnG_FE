import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styles from "../styles/pages/ReservationDetail.module.css";
import {
  getReservationDetail,
  confirmReservationApi,
  cancelReservationApi,
  completeReservationApi,
} from "../api/reservationApi";
import Header from "../components/Header/Header";
import { useAuth } from "../context/AuthContext";
import RotateIcon from "../assets/3d-rotate.svg";
import BoxIcon from "../assets/box.svg";
import CalendarIcon from "../assets/calendar copy.svg";
import ClockIcon from "../assets/clock copy.svg";
import { Modal, useModal } from "../components/common/ModalUtil";
import CheckIcon from "../components/reservation/CheckIcon";
import { getConversationByPeer, getOrCreateConversation } from "../api/chatApi";
import BsChat from "../assets/messages.svg";

const ReservationDetail = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams();
  const { search } = useLocation();
  const urlParams = new URLSearchParams(search);
  const isFromReservation = urlParams.get("from") === "reservation"; // 예약 완료 직후인지 확인

  const { user } = useAuth(); // AuthContext에서 사용자 정보 가져오기
  const memberId = user?.id; // memberId 파싱

  console.log("memberId:", memberId);
  const [reservationData, setReservationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { showError, showSuccess, showConfirm, modalState, hideModal } = useModal();

  // 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // API 호출 함수
  const fetchReservationDetail = async (reservationId, memberId) => {
    try {
      setLoading(true);
      const response = await getReservationDetail(reservationId, memberId);
      setReservationData(response.result);
    } catch (err) {
      console.error("예약 상세 정보 조회 실패:", err);
      setError(
        err.response?.result?.message || "예약 상세 정보를 불러올 수 없습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 API 호출
  useEffect(() => {
    if (reservationId && memberId) {
      fetchReservationDetail(reservationId, memberId);
    }
  }, [reservationId, memberId]);

  // 필수 매개변수가 없는 경우 처리
  if (!reservationId || !memberId) {
    return (
      <div className={styles.reservationDetail}>
        <Header headerTitle="예약 상세" showBackButton />
        <div className={styles.content}>
          <div className="error-message">
            잘못된 접근입니다. 필요한 정보가 없습니다.
          </div>
        </div>
      </div>
    );
  }

  // 로딩 중이거나 에러가 있을 때 처리
  // if (loading) {
  //   return (
  //     <div className={styles.reservationDetail}>
  //       <Header headerTitle="예약 상세" showBackButton />
  //       <div className={styles.content}>
  //         <div style={{ textAlign: "center", padding: "50px 0" }}>
  //           로딩 중...
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  if (error) {
    return (
      <div className={styles.reservationDetail}>
        <Header headerTitle="예약 상세" showBackButton />
        <div className={styles.content}>
          <div
            style={{ textAlign: "center", padding: "50px 0", color: "#ff4444" }}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  const data = reservationData?.result || reservationData;

  // userRole 계산: keeperId, dropperId와 현재 사용자 ID 비교
  const userRole =
    data?.keeperId === memberId
      ? "keeper"
      : data?.dropperId === memberId
      ? "dropper"
      : "unknown";

  if (!data) {
    return (
      <div className={styles.reservationDetail}>
        <Header headerTitle="예약 상세" showBackButton />
        <div className={styles.content}>
          <div style={{ textAlign: "center", padding: "50px 0" }}>
            데이터가 없습니다.
          </div>
        </div>
      </div>
    );
  }

  // Parse dates
  const startDate = new Date(data.startTime);
  const endDate = new Date(data.endTime);

  // Format dates
  const formatDate = (date) => {
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // 시간 포맷팅 함수 (FormPage와 동일)
  const formatHours = (hours) => {
    if (hours === 1) return "1시간";
    if (hours < 1) return `${Math.round(hours * 60)}분`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  };

  // Calculate total price (FormPage 로직과 동일하게 수정)
  const calculateTotal = () => {
    const diffMs = endDate - startDate;
    const totalHours = diffMs / (1000 * 60 * 60);
    let totalItemPrice = 0;
    const items = [];

    if (data.reservationJimTypes && data.reservationJimTypes.length > 0) {
      data.reservationJimTypes.forEach((item) => {
        const itemPrice = item.count * item.pricePerHour * totalHours;
        totalItemPrice += itemPrice;
        items.push({
          name: item.typeName,
          count: item.count,
          hours: totalHours,
          price: itemPrice,
        });
      });
    }

    const serviceFee = Math.floor(totalItemPrice * 0.05); // 5% 수수료
    const total = Math.floor(totalItemPrice + serviceFee);

    return {
      itemTotal: totalItemPrice,
      serviceFee: serviceFee,
      total: total,
      items: items,
    };
  };

  const pricing = calculateTotal();

  const handleChatGo = async () => {
    if (!data?.keeperId || userRole !== "dropper") return;
    try {
      let convId;
      const res = await getConversationByPeer(data.keeperId);
      convId = res?.id || res?.convId || res?.data?.result?.convId;
      if (!convId) {
        const createRes = await getOrCreateConversation(data.keeperId);
        convId = createRes?.id || createRes?.convId || createRes?.data?.result?.convId;
      }
      if (convId) {
        navigate(`/page/chat/${convId}`);
      } else {
        showError("채팅 오류", "대화방을 찾거나 생성할 수 없습니다.");
      }
    } catch (e) {
      showError("채팅 오류", "대화방을 찾거나 생성할 수 없습니다.");
    }
  };

  // 수수료 안내와 함께 취소 확인
  const handleCancelWithFeeConfirm = () => {
    const reservationState = data.state || data.result?.state;
    
    if (reservationState === "CONFIRMED") {
      // CONFIRMED 상태에서는 수수료 안내 포함
      const cancelMessage = `⚠️ 취소 수수료 안내

예약 확정 후 취소 시 수수료가 발생할 수 있어요!
• 당일 취소: 20%
• 하루 전 취소: 10%  
• 그 외: 수수료 없음

결제 금액: ${pricing.total.toLocaleString()}원
(*정확한 수수료는 취소 처리 후 안내됩니다)`;

      showConfirm(
        "예약 취소",
        cancelMessage,
        handleCancel,
        () => {}
      );
    } else {
      // 다른 상태에서는 바로 취소
      showConfirm(
        "예약 취소",
        "정말로 예약을 취소하시겠습니까?",
        handleCancel,
        () => {}
      );
    }
  };

  const handleCancel = async () => {
    try {
      const response = await cancelReservationApi(reservationId);
      const data = response.data;

      if (data.code === 1000) {
        setReservationData((prevData) => ({
          ...prevData,
          state: data.result.state,
        }));
        const result = data.result;
        const totalAmount = result ? result.amount + result.fee : 0;
        const refundAmount = totalAmount - (result ? result.chargeFee : 0);
        const refundMessage = result.chargeFee !== 0 
          ? `💰 환불 정보

          결제 금액: ${totalAmount.toLocaleString()}원
          취소 수수료: ${result.chargeFee.toLocaleString()}원
          환불 금액: ${refundAmount.toLocaleString()}원
(*1일내 환불 처리)`
          : `전액 환불 처리됩니다.
(*1일내 환불 처리)`;
      
        showSuccess("취소 완료", refundMessage);
      } else {
        showError("예약 취소 실패", data.message);
      }
    } catch (error) {
      console.error("예약 취소 실패:", error);
      showError("예약 취소 실패", "네트워크 오류. 잠시 후 다시 시도해주세요.");
    }
  };

  // 승인/거절 핸들러
  const handleConfirm = async (approve) => {
    const approveStr = approve ? "승인" : "거절";

    try {
      const response = await confirmReservationApi(reservationId, approve);
      const data = response.data;

      if (data.code === 1000) {
        // 상태 업데이트: reservationData의 state를 새로운 상태로 변경
        setReservationData((prevData) => ({
          ...prevData,
          state: data.result.state,
        }));
        showSuccess(approveStr + "되었습니다!", "");
      } else {
        showError(approveStr + " 실패", data.message);
      }
    } catch (error) {
      console.error(`예약 ${approveStr} 실패:`, error);
      showError(
        approveStr + " 실패",
        "네트워크 오류. 잠시 후 다시 시도해주세요."
      );
    }
  };

  function getCompleteBtnProps(reservation, userRole) {
    const { state } = reservation;
    if (state === "COMPLETED") {
      return { disabled: true, label: "완료된 예약입니다" };
    }
    if (state === "CONFIRMED") {
      return { disabled: false, label: "예약 완료 되셨나요?" };
    }
    if (state === "COMPLETING_DROPPER_ONLY") {
      if (userRole === "host") return { disabled: false, label: "예약 완료 되셨나요?" };
      if (userRole === "customer") return { disabled: true, label: "상대방의 완료 확인 대기중" };
    }
    if (state === "COMPLETING_KEEPER_ONLY") {
      if (userRole === "customer") return { disabled: false, label: "예약 완료 되셨나요?" };
      if (userRole === "host") return { disabled: true, label: "상대방의 완료 확인 대기중" };
    }
    return { disabled: true, label: "" };
  }

  return (
    <div className={styles.reservationDetail}>
      {isFromReservation && <Header headerTitle="예약 상세" showHomeButton />}
      {!isFromReservation && <Header headerTitle="예약 상세" showBackButton />}

      <div className={styles.content}>
        {/* 예약 완료 메시지 (예약 직후에만 표시) */}
        {isFromReservation && (
          <div className={styles.reservationSuccess}>
            <div className={styles.successIcon}>
              <CheckIcon strokeWidth={6} />
            </div>
            <h2 className={styles.successTitle}>예약이 완료되었습니다!</h2>
          </div>
        )}

        <div className={styles.lockerInfo}>
          <img
            src={
              data.images && data.images.length > 0
                ? data.images[0]
                : "/api/placeholder/60/60"
            }
            alt="보관소 이미지"
            className={styles.lockerImage}
          />
          <div className={styles.lockerDetails}>
            <h2 className={styles.lockerName}>{data.lockerName || "보관소"}</h2>
            <p className={styles.lockerAddress}>{data.fullAddress || "주소 정보 없음"}</p>
          </div>
        </div>

        <div className={styles.reservationSection}>
          <h3 className={styles.sectionTitle}>보관 날짜</h3>
          <div className={styles.sectionContent}>
            <img
              src={CalendarIcon}
              alt="달력 아이콘"
              className={styles.sectionIcon}
              width="20"
              height="20"
            />
            <span>
              {formatDate(startDate)} ~ {formatDate(endDate)}
            </span>
          </div>
        </div>

        <div className={styles.reservationSection}>
          <h3 className={styles.sectionTitle}>보관 시간</h3>
          <div className={styles.sectionContent}>
            <img
              src={ClockIcon}
              alt="시계 아이콘"
              className={styles.sectionIcon}
              width="20"
              height="20"
            />
            <span>
              {formatTime(startDate)} ~ {formatTime(endDate)}
            </span>
          </div>
        </div>

        <div className={styles.reservationSection}>
          <h3 className={styles.sectionTitle}>짐 종류</h3>
          <div className={styles.jimTypes}>
            {data.reservationJimTypes &&
              data.reservationJimTypes.map((item, index) => (
                <div key={index} className={styles.jimTypeItem}>
                  <img
                    src={BoxIcon}
                    alt="박스 아이콘"
                    className={styles.sectionIcon}
                    width="20"
                    height="20"
                  />
                  <span>
                    {item.typeName} {item.count}개
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className={styles.reservationSection}>
          <h3 className={styles.sectionTitle}>픽업 방식</h3>
          <div className={styles.sectionContent}>
            <img
              src={RotateIcon}
              alt="회전 아이콘"
              className={styles.sectionIcon}
              width="20"
              height="20"
            />
            <span>직접 짐 건네주기</span>
          </div>
        </div>

        <div className={styles.priceCalculation}>
          {pricing.items.map((item, index) => (
            <div key={index} className={styles.priceItem}>
              <span>
                {item.name} × {item.count}개 × {formatHours(item.hours)}
              </span>
              <span>{item.price.toLocaleString()}원</span>
            </div>
          ))}
          <div className={styles.priceItem}>
            <span>서비스 수수료 (5%)</span>
            <span>{pricing.serviceFee.toLocaleString()}원</span>
          </div>
          <hr className={styles.priceDivider} />
          <div className={styles.priceTotal}>
            <span>총 결제 금액</span>
            <span>{pricing.total.toLocaleString()}원</span>
          </div>
        </div>

        <div className={styles.notice}>
          <p>* 30분안에 승인하지 않으면 자동거절됩니다.</p>
        </div>

        {/* 상태별 버튼 렌더링 */}
        {(() => {
          const reservationState = data.state || data.result?.state;
          console.log("예약 상태:", reservationState);
          console.log("data: ", data);

          // 완료대기/완료 상태 버튼 처리
          if (
            reservationState === "CONFIRMED" ||
            reservationState === "COMPLETING_DROPPER_ONLY" ||
            reservationState === "COMPLETING_KEEPER_ONLY" ||
            reservationState === "COMPLETED"
          ) {
            // 역할 구분
            let btnProps = { disabled: true, label: "" };
            if (reservationState === "COMPLETED") {
              btnProps = { disabled: true, label: "완료된 예약입니다" };
            } else if (reservationState === "CONFIRMED") {
              btnProps = { disabled: false, label: "예약 완료 되셨나요?" };
            } else if (reservationState === "COMPLETING_DROPPER_ONLY") {
              if (userRole === "keeper")
                btnProps = { disabled: false, label: "예약 완료 되셨나요?" };
              if (userRole === "dropper")
                btnProps = { disabled: true, label: "상대방의 완료 확인 대기중" };
            } else if (reservationState === "COMPLETING_KEEPER_ONLY") {
              if (userRole === "dropper")
                btnProps = { disabled: false, label: "예약 완료 되셨나요?" };
              if (userRole === "keeper")
                btnProps = { disabled: true, label: "상대방의 완료 확인 대기중" };
            }

            return (
              <div className={styles.actionButtons} style={{ justifyContent: "center" }}>
                <button
                  className={btnProps.disabled ? styles.btnDisabled : styles.btnConfirm}
                  disabled={btnProps.disabled}
                  style={{ width: "100%" }}
                  onClick={async () => {
                    if (!btnProps.disabled) {
                      // 완료 확인 API 호출
                      const response = await completeReservationApi(data.reservationId);
                      if (response.data.code === 1000) {
                        setReservationData((prevData) => ({
                          ...prevData,
                          state: response.data.result.state,
                        }));
                        showSuccess(
                          "예약 완료 처리되었습니다!",
                          "",
                          () => navigate("/page/reservations/list")
                        );
                      } else {
                        showError("예약 완료 처리에 실패했습니다.", response.data.message);
                      }
                    }
                  }}
                >
                  {btnProps.label}
                </button>
              </div>
            );
          }

          if (reservationState === "PENDING") {
            console.log("userRole:", userRole);
            // PENDING 상태: keeper는 거절/승인, dropper는 취소
            return (
              <div
                className={styles.actionButtons}
                style={
                  userRole === "dropper" ? { justifyContent: "center" } : {}
                }
              >
                {userRole === "keeper" ? (
                  <>
                    <button
                      className={styles.btnCancel}
                      onClick={() => handleConfirm(false)}
                    >
                      거절
                    </button>
                    <button
                      className={styles.btnConfirm}
                      onClick={() => handleConfirm(true)}
                    >
                      승인
                    </button>
                  </>
                ) : userRole === "dropper" ? (
                  <>
                    <button
                      className={styles.btnCancel}
                      onClick={handleCancelWithFeeConfirm}
                      style={{ width: "100%" }}
                    >
                      취소
                    </button>
                    <button
                      className={styles.chatGoBtn}
                      onClick={handleChatGo}
                      aria-label="채팅 바로가기"
                    >
                    <img src={BsChat} className={styles.chatIcon} alt="채팅" width={22} height={22} />
                    </button>
                  </>
                ) : null}
              </div>
            );
          } else if (reservationState === "CANCELLED") {
            // CANCELLED 상태: keeper는 예약이 취소됐어요, dropper는 예약취소완료
            return (
              <div
                className={styles.actionButtons}
                style={{ justifyContent: "center" }}
              >
                <button
                  className={styles.btnDisabled}
                  disabled
                  style={{ width: "100%" }}
                >
                  {userRole === "keeper" ? "예약이 취소됐어요" : "예약취소완료"}
                </button>
              </div>
            );
          } else if (reservationState === "REJECTED") {
            // REJECTED 상태: keeper는 예약반려완료, dropper는 예약이 반려됐어요
            return (
              <div
                className={styles.actionButtons}
                style={{ justifyContent: "center" }}
              >
                <button
                  className={styles.btnDisabled}
                  disabled
                  style={{ width: "100%" }}
                >
                  {userRole === "keeper" ? "예약반려완료" : "예약이 반려됐어요"}
                </button>
              </div>
            );
          }

          // 기본 상태 (알 수 없는 상태)
          return null;
        })()}
      </div>

      {/* Modal 컴포넌트 추가 */}
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
    </div>
  );
};

export default ReservationDetail;
