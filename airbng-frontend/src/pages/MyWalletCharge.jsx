import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { walletApi } from "../api/myWalletApi";
import { getOrCreateIdemKey, clearIdemKey } from "../utils/idempotency";
import styles from "../styles/pages/WalletCharge.module.css";
import { Modal, useModal } from "../components/common/ModalUtil";

export default function WalletCharge() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  // 상태 관리
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isCharging, setIsCharging] = useState(false);

  //모달
  const {
    modalState,
    hideModal,
    showSuccess,
    showError,
    showConfirm,
    showLoading,
  } = useModal();

  // 은행 아이콘 매핑 함수
  const getBankIcon = (bankCode) => {
    switch (bankCode) {
      case 6: // 국민
        return require("../assets/bank-kb.svg").default;
      case 88: // 신한
        return require("../assets/bank-shinhan.svg").default;
      case 11: // 농협
        return require("../assets/bank-noghyeup.svg").default;
      case 81: // 하나
        return require("../assets/bank-hana.svg").default;
      case 90: // 카카오
        return require("../assets/bank-kakao.svg").default;
      case 92: // 토스
        return require("../assets/bank-toss.svg").default;
      default:
        return require("../assets/bank-default.svg").default;
    }
  };

  // 금액 포맷터
  const formatWon = (amount) => {
    if (amount == null) return "0원";
    const num = typeof amount === "number" ? amount : Number(amount);
    if (Number.isNaN(num)) return "0원";
    return new Intl.NumberFormat("ko-KR").format(num);
  };

  // 계좌번호 마스킹
  const maskAccountNumber = (accountNumber) => {
    if (!accountNumber) return "";
    if (accountNumber.length <= 4) return accountNumber;
    const visiblePart = accountNumber.slice(-4);
    const maskedPart = "*".repeat(accountNumber.length - 4);
    return maskedPart + visiblePart;
  };

  // 지갑 정보 조회
  const fetchWalletData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await walletApi.getWalletInfo();

      if (response.status === 200 && response.data.code === 1000) {
        const data = response.data.result;
        setWalletData(data);

        // 주계좌를 기본 선택으로 설정
        const primaryAccount = data.accounts?.find(
          (account) => account.primary
        );
        if (primaryAccount) {
          setSelectedAccount(primaryAccount);
        }
      } else {
        setError(response.data?.message || "지갑 정보를 불러올 수 없습니다.");
      }
    } catch (err) {
      console.error("지갑 정보 조회 실패:", err);
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    if (isLoggedIn) {
      fetchWalletData();
    } else {
      navigate("/page/login");
    }
  }, [isLoggedIn, fetchWalletData, navigate]);

  // 뒤로가기 처리
  const handleBack = () => {
    // 예약 상태가 저장되어 있는 경우 예약 페이지로 돌아감
    const hasReservationState = sessionStorage.getItem("reservationState");
    const lockerId = JSON.parse(hasReservationState)?.lockerId;
    if (lockerId) {
      navigate(`/page/reservations/form?lockerId=${lockerId}`, { replace: true });
    } else {
      navigate("/page/mypage", { replace: true });
    }
  };
  // 계좌 등록 페이지로 이동하는 함수 추가
  const goToAddAccount = () => {
    navigate("/page/mypage/account/add");
  };

  // 충전 금액 입력
  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setChargeAmount(value);
  };

  // 금액 버튼 클릭
  const handleAmountButton = (amount) => {
    const currentAmount = parseInt(chargeAmount) || 0;
    const newAmount = currentAmount + amount;
    if (newAmount <= 300000) {
      setChargeAmount(newAmount.toString());
    }
  };

  // 최대 금액 설정
  const handleMaxAmount = () => {
    setChargeAmount("300000"); // 최대 30만원
  };

  // 계좌 선택
  const handleAccountSelect = (account) => {
    setSelectedAccount(account);
  };

  // 충전하기
  const handleCharge = async () => {
    if (!selectedAccount) {
      showError("계좌 선택", "충전할 계좌를 선택해주세요.");
      return;
    }

    if (!chargeAmount || parseInt(chargeAmount) < 1000) {
      showError(
        "충전 금액 부족",
        "충전 금액은 최소 1,000원 이상이어야 합니다."
      );
      return;
    }

    if (parseInt(chargeAmount) > 300000) {
      showError("충전 금액 제한", "1회 충전 가능 금액은 최대 300,000원입니다.");
      return;
    }

    setIsCharging(true);

    try {
      await showLoading("충전 처리 중입니다...", "잠시만 기다려주세요", 500);
      // 멱등키 생성
      const scope = `wallet:topup:${selectedAccount.accountId}:${chargeAmount}`;
      const idemKey = getOrCreateIdemKey(scope);

      const requestData = {
        accountId: selectedAccount.accountId,
        balance: parseInt(chargeAmount),
      };

      const response = await walletApi.chargePoint(requestData, idemKey);

      if (response.status === 200 && response.data.code === 1000) {
        clearIdemKey(scope);
        // 예약 상태 확인 후 네비게이션 분기처리
        const hasReservationState = sessionStorage.getItem("reservationState");

        showSuccess("충전 완료", `정상적으로 충전되었습니다.`, () => {
          if (hasReservationState) {
            navigate(-1); // 예약 페이지로 돌아가기
          } else {
            navigate("/page/mypage/wallet", {
              state: {
                message: `${formatWon(parseInt(chargeAmount))}`,
              },
            });
          }
        });
      } else {
        showError(
          "충전 실패",
          response.data?.message || "충전에 실패했습니다."
        );
      }
    } catch (error) {
      console.error("충전 실패:", error);
      if (error.response?.status === 400) {
        showError("충전 실패", "입력 정보를 확인해주세요.");
      } else if (error.response?.status === 409) {
        showError("충전 실패", "이미 처리 중인 요청입니다.");
      } else {
        showError("충전 실패", "다시 시도해주세요.");
      }
    } finally {
      setIsCharging(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.backButton} onClick={handleBack} />
          </div>
          <h1 className={styles.headerTitle}>짐페이 충전</h1>
        </header>
        <main className={styles.mainContent}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>로딩 중...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.backButton} onClick={handleBack} />
          </div>
          <h1 className={styles.headerTitle}>짐페이 충전</h1>
        </header>
        <main className={styles.mainContent}>
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={fetchWalletData}>다시 시도</button>
          </div>
        </main>
      </div>
    );
  }

  const hasAccounts = walletData?.accounts?.length > 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={handleBack} />
        </div>
        <h1 className={styles.headerTitle}>짐페이 충전</h1>
      </header>

      <main className={styles.mainContent}>
        {/* 충전 금액 섹션 */}
        <div className={styles.amountSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>충전 금액</h2>
            <span className={styles.limitInfo}>충전 가능 금액 300,000원</span>
          </div>

          <div className={styles.amountInput}>
            <input
              type="text"
              value={chargeAmount ? formatWon(parseInt(chargeAmount)) : ""}
              onChange={handleAmountChange}
              placeholder="충전 금액 입력 (최소 1000원)"
              className={styles.amountField}
            />
          </div>

          <div className={styles.amountButtons}>
            <button
              className={styles.amountBtn}
              onClick={() => handleAmountButton(10000)}
            >
              + 1만원
            </button>
            <button
              className={styles.amountBtn}
              onClick={() => handleAmountButton(50000)}
            >
              + 5만원
            </button>
            <button
              className={styles.amountBtn}
              onClick={() => handleAmountButton(100000)}
            >
              + 10만원
            </button>
            <button className={styles.amountBtn} onClick={handleMaxAmount}>
              + 최대
            </button>
          </div>
        </div>

        {/* 출금 계좌 섹션 */}
        <div className={styles.accountSection}>
          <h2 className={styles.sectionTitle}>출금 계좌</h2>

          {hasAccounts ? (
            <div className={styles.accountList}>
              {walletData.accounts.map((account) => (
                <div
                  key={account.accountId}
                  className={`${styles.accountCard} ${
                    selectedAccount?.accountId === account.accountId
                      ? styles.selected
                      : ""
                  }`}
                  onClick={() => handleAccountSelect(account)}
                >
                  <div className={styles.accountInfo}>
                    <div className={styles.bankInfo}>
                      <img
                        src={getBankIcon(account.bankCodes?.[0]?.bankCode)}
                        alt={`${account.bankCodes?.[0]?.korName} 로고`}
                        className={styles.bankIcon}
                      />
                      <div className={styles.bankDetails}>
                        <div className={styles.bankName}>
                          {account.bankCodes?.[0]?.korName || "은행"}은행
                          {account.primary && (
                            <span className={styles.primaryBadge}>주계좌</span>
                          )}
                        </div>
                        <div className={styles.accountNumber}>
                          {maskAccountNumber(account.accountNumber)}
                        </div>
                        <div className={styles.holderName}>
                          계좌주: {account.holderName}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.selectRadio}>
                    <input
                      type="radio"
                      name="account"
                      checked={selectedAccount?.accountId === account.accountId}
                      onChange={() => handleAccountSelect(account)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // noAccount 부분 수정
            <div className={styles.noAccount}>
              <h3 className={styles.noAccountTitle}>연동된 계좌가 없습니다</h3>
              <p className={styles.noAccountDesc}>
                계좌를 등록하면 쉽게 충전하고
                <br />
                출금할 수 있어요
              </p>
              <button className={styles.addAccountBtn} onClick={goToAddAccount}>
                계좌 등록하기
              </button>
            </div>
          )}
        </div>

        {/* 이용 안내 - amountSection 다음에 추가 */}
        <div className={styles.infoSection}>
          <h3 className={styles.infoTitle}>이용 안내</h3>
          <ul className={styles.infoList}>
            <li>짐페이는 충전완료부터 5년까지 사용할 수 있어요.</li>
            <li>
              짐페이 1회 충전 가능 금액은 최대 30만원으로, 초과 시 충전이
              제한됩니다.
            </li>
          </ul>
        </div>
        {/* 충전하기 버튼 */}
        <button
          className={`${styles.chargeBtn} ${
            !selectedAccount || !chargeAmount || isCharging
              ? styles.disabled
              : ""
          }`}
          onClick={handleCharge}
          disabled={!selectedAccount || !chargeAmount || isCharging}
        >
          {isCharging ? "충전 중..." : "충전하기"}
        </button>
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
