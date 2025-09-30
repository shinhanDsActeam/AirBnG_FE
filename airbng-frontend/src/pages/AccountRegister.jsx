import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { walletApi } from "../api/myWalletApi";
import styles from "../styles/pages/AccountRegister.module.css";
import { Modal, useModal } from "../components/common/ModalUtil";

// 지원하는 은행 목록
const SUPPORTED_BANKS = [
  {
    bankCode: 6,
    korName: "국민",
    icon: require("../assets/bank-kb.svg").default,
  },
  {
    bankCode: 88,
    korName: "신한",
    icon: require("../assets/bank-shinhan.svg").default,
  },
  {
    bankCode: 11,
    korName: "농협",
    icon: require("../assets/bank-noghyeup.svg").default,
  },
  {
    bankCode: 81,
    korName: "하나",
    icon: require("../assets/bank-hana.svg").default,
  },
  {
    bankCode: 90,
    korName: "카카오",
    icon: require("../assets/bank-kakao.svg").default,
  },
  {
    bankCode: 92,
    korName: "토스",
    icon: require("../assets/bank-toss.svg").default,
  },
];
const hasReservationState = sessionStorage.getItem("reservationState");

export default function AccountRegister() {
  const navigate = useNavigate();

  // 폼 상태
  const [selectedBank, setSelectedBank] = useState(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  //모달
  const {
    modalState,
    hideModal,
    showSuccess,
    showError,
    showConfirm,
    showLoading,
  } = useModal();

  // 뒤로가기
  const handleBack = () => {
    if (hasReservationState) {
      navigate("/page/mypage/wallet/charge", { replace: true });
    } else {
      navigate("/page/mypage/wallet", { replace: true });
    }
  };

  // 은행 선택
  const handleBankSelect = (bank) => {
    setSelectedBank(bank);
    setIsDropdownOpen(false);
    setErrors((prev) => ({ ...prev, bank: "" }));
  };

  // 계좌번호 입력 (표시용 포맷팅 추가)
  const handleAccountNumberChange = (e) => {
    // 숫자만 추출
    const value = e.target.value.replace(/[^0-9]/g, "");

    // 16자리 제한
    if (value.length <= 16) {
      setAccountNumber(value);
      setErrors((prev) => ({ ...prev, accountNumber: "" }));
    }
  };
  // 계좌번호 표시용 포맷팅 함수
  const formatAccountNumber = (number) => {
    if (!number) return "";

    // 3-4-나머지 형식으로 포맷팅
    if (number.length <= 3) {
      return number;
    } else if (number.length <= 7) {
      return `${number.slice(0, 3)}-${number.slice(3)}`;
    } else {
      return `${number.slice(0, 3)}-${number.slice(3, 7)}-${number.slice(7)}`;
    }
  };

  // 예금주명 입력
  const handleHolderNameChange = (e) => {
    const value = e.target.value.trim();
    setHolderName(value);
    setErrors((prev) => ({ ...prev, holderName: "" }));
  };

  // 유효성 검증
  const validateForm = () => {
    const newErrors = {};

    if (!selectedBank) {
      newErrors.bank = "은행을 선택해주세요.";
    }

    if (!accountNumber.trim()) {
      newErrors.accountNumber = "계좌번호를 입력해주세요.";
    } else if (accountNumber.length < 10) {
      newErrors.accountNumber = "올바른 계좌번호를 입력해주세요.";
    }

    if (!holderName.trim()) {
      newErrors.holderName = "예금주명을 입력해주세요.";
    } else if (holderName.length < 2) {
      newErrors.holderName = "예금주명은 2글자 이상 입력해주세요.";
    }

    // 유효성 검증 (계좌번호 부분만)
    if (!accountNumber.trim()) {
      newErrors.accountNumber = "계좌번호를 입력해주세요.";
    } else if (accountNumber.length < 10 || accountNumber.length > 16) {
      newErrors.accountNumber =
        "계좌번호는 10자 이상 16자 이하로 입력해주세요.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  //계좌 등록
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const requestData = {
        bankCode: selectedBank.bankCode,
        accountNumber: accountNumber,
        holderName: holderName,
      };

      const response = await walletApi.registerAccount(requestData);

      if (response.status === 200 && response.data.code === 1000) {
        // 성공 시 모달 표시
        showSuccess(
          "계좌 등록 완료",
          "계좌가 성공적으로 등록되었습니다.",
          () => {
            // 세션 스토리지 확인
            const hasReservationState =
              sessionStorage.getItem("reservationState");

            if (hasReservationState) {
              navigate(-1); // 예약 페이지로 돌아가기 (2단계 뒤로)
            } else {
              navigate("/page/mypage/wallet"); // 지갑 페이지로 이동
            }
          }
        );
      } else {
        // API 에러 시 에러 모달 표시
        showError(
          "계좌 등록 실패",
          response.data?.message || "계좌 등록에 실패했습니다."
        );
      }
    } catch (error) {
      console.error("계좌 등록 실패:", error);
      if (error.response?.status === 400) {
        showError(
          "계좌 등록 실패",
          "잘못된 계좌 정보입니다. 다시 확인해주세요."
        );
      } else {
        showError(
          "계좌 등록 실패",
          "네트워크 오류가 발생했습니다. 다시 시도해주세요."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={handleBack} />
        </div>
        <h1 className={styles.headerTitle}>계좌 등록</h1>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.notice}>
          <h2 className={styles.noticeTitle}>
            안전한 서비스 이용을 위해
            <br />
            본인명의 계좌를 등록하세요
          </h2>
          <p className={styles.noticeDesc}>
            타인명의의 계좌는 등록이 제한되며
            <br />본 등록은 한번만 가능합니다.
          </p>
        </div>

        <div className={styles.form}>
          {/* 은행 선택 */}
          <div className={styles.field}>
            <label className={styles.label}>은행</label>
            <div className={styles.selectWrapper}>
              <div
                className={`${styles.selectBox} ${
                  errors.bank ? styles.error : ""
                }`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                {selectedBank ? (
                  <div className={styles.selectedBank}>
                    <img
                      src={selectedBank.icon}
                      alt={selectedBank.korName}
                      className={styles.bankIcon}
                    />
                    <span>{selectedBank.korName}은행</span>
                  </div>
                ) : (
                  <span className={styles.placeholder}>은행을 선택하세요</span>
                )}
                <span
                  className={`${styles.arrow} ${
                    isDropdownOpen ? styles.open : ""
                  }`}
                >
                  ▼
                </span>
              </div>

              {isDropdownOpen && (
                <div className={styles.dropdown}>
                  {SUPPORTED_BANKS.map((bank) => (
                    <div
                      key={bank.bankCode}
                      className={styles.dropdownItem}
                      onClick={() => handleBankSelect(bank)}
                    >
                      <img
                        src={bank.icon}
                        alt={bank.korName}
                        className={styles.bankIcon}
                      />
                      <span>{bank.korName}은행</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.bank && <p className={styles.errorText}>{errors.bank}</p>}
          </div>

          {/* 계좌번호 */}
          <div className={styles.field}>
            <label className={styles.label}>계좌번호</label>
            <input
              type="text"
              className={`${styles.input} ${
                errors.accountNumber ? styles.error : ""
              }`}
              placeholder="'-' 없이 숫자만 입력"
              value={formatAccountNumber(accountNumber)}
              onChange={handleAccountNumberChange}
              maxLength={18} // 하이픈 포함 최대 길이
            />
            {errors.accountNumber && (
              <p className={styles.errorText}>{errors.accountNumber}</p>
            )}
          </div>

          {/* 예금주명 */}
          <div className={styles.field}>
            <label className={styles.label}>예금주</label>
            <input
              type="text"
              className={`${styles.input} ${
                errors.holderName ? styles.error : ""
              }`}
              placeholder="예금주명을 입력하세요"
              value={holderName}
              onChange={handleHolderNameChange}
              maxLength={10}
            />
            {errors.holderName && (
              <p className={styles.errorText}>{errors.holderName}</p>
            )}
          </div>

          {/* 약관 동의 */}
          <div className={styles.agreement}>
            <div className={styles.agreementItem}>
              <input
                type="checkbox"
                id="agreement"
                className={styles.checkbox}
                defaultChecked
              />
              <label htmlFor="agreement" className={styles.agreementText}>
                (필수) 개인정보 수집 이용 동의
              </label>
            </div>
          </div>

          {/* 에러 메시지 */}
          {errors.submit && (
            <div className={styles.submitError}>{errors.submit}</div>
          )}

          {/* 등록 버튼 */}
          <button
            className={`${styles.submitBtn} ${
              !selectedBank || !accountNumber || !holderName || isSubmitting
                ? styles.disabled
                : ""
            }`}
            onClick={handleSubmit}
            disabled={
              !selectedBank || !accountNumber || !holderName || isSubmitting
            }
          >
            {isSubmitting ? "등록 중..." : "등록"}
          </button>
        </div>
        {/* 모달 컴포넌트 */}
        <Modal
          show={modalState.show}
          type={modalState.type}
          title={modalState.title}
          message={modalState.message}
          confirmText={modalState.confirmText}
          onConfirm={modalState.onConfirm}
          onClose={hideModal}
        />
      </main>
    </div>
  );
}
