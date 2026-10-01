'use client';
import { Icon } from '../icons';
import { todayIso, fdate } from '../../lib/format';

export const Header = () => {
  return (
    <header className="header">
      <button className="menu-btn icon-btn"><Icon name="bars" /></button>
      <div className="gsearch">
        <Icon name="search" />
        <input type="text" placeholder="Buscar expediente, NIT, contratista..." />
      </div>
      <div className="hsp"></div>
      <div className="hdate">{fdate(todayIso())}</div>
      <button className="hbtn"><Icon name="bell" /><span className="dot">3</span></button>
      <div className="user">
        <div className="avatar">AD</div>
        <div>
          <div className="user-n">Admin</div>
          <div className="user-r">Administrador</div>
        </div>
      </div>
    </header>
  );
};
