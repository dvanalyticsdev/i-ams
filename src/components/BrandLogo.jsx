import React from 'react';

// C:\\Users\\patel\\OneDrive\\Documents\\DV_project\\i-ams\\src\\components\\BrandLogo.jsx

export const LogoFull = () => {
  return (
    <div className="icrm-logo-wrap icrm-logo--brand">
      <div className="icrm-text-wrap">
        <span className="icrm-logo-text">i-AMS</span>
      </div>
      <div className="icrm-dv-badge">
        <span className="icrm-dv-by">by</span>
        <img src="/Logos/DV-Logo.png" alt="DV Analytics" className="icrm-dv-img" />
      </div>
    </div>
  );
};

export const LogoSidebar = () => {
  return (
    <div className="icrm-logo-wrap">
      <div className="icrm-text-wrap">
        <span className="icrm-logo-text">i-AMS</span>
      </div>
      <div className="icrm-dv-badge">
        <span className="icrm-dv-by">by</span>
        <img src="/Logos/DV-Logo.png" alt="DV Analytics" className="icrm-dv-img" />
      </div>
    </div>
  );
};


