import React from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as CartIcon } from '../../assets/shopping-cart.svg';
import { ReactComponent as ChatIcon } from '../../assets/messages.svg';
import { ReactComponent as HomeIcon } from '../../assets/home.svg';
import { ReactComponent as CalendarIcon } from '../../assets/calendar.svg';
import { ReactComponent as UserIcon } from '../../assets/user.svg';
import { useUnread } from '../../context/UnreadContext';
import { useAuth } from '../../context/AuthContext';

import "../../styles/layout/navigation.css";

function Navbar({ active = "home" }) {
  const { total } = useUnread();              // 전체 미확인 개수
  const { isLoggedIn } = useAuth() || {};
  const showBadge = !!isLoggedIn && total > 0;

  return (
    <nav className="bottom-nav">
      <Link to="/page/lockers" className={`nav-item${active === "cart" ? " active" : ""}`}>
        <CartIcon className="nav-icon" />
        <span className="nav-text">보관소</span>
      </Link>

      <Link to="/page/chatList" className={`nav-item${active === "chat" ? " active" : ""}`}>
        {showBadge ? (
          <span className="nav-icon-wrap">
            <ChatIcon className="nav-icon" />
            <span className="nav-badge">{total > 99 ? '99+' : total}</span>
          </span>
        ) : (
          <ChatIcon className="nav-icon" />
        )}
        <span className="nav-text">채팅</span>
      </Link>

      <Link to="/page/home" className={`nav-item${active === "home" ? " active" : ""}`}>
        <HomeIcon className="nav-icon" />
        <span className="nav-text">홈</span>
      </Link>

      <Link to="/page/reservations/list" className={`nav-item${active === "calendar" ? " active" : ""}`}>
        <CalendarIcon className="nav-icon" />
        <span className="nav-text">예약</span>
      </Link>

      <Link to="/page/mypage" className={`nav-item${active === "mypage" ? " active" : ""}`}>
        <UserIcon className="nav-icon" />
        <span className="nav-text">마이</span>
      </Link>
    </nav>
  );
}

export default Navbar;
