import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export interface WebSettings {
  web_title: string;
  web_brand_name: string;
  web_brand_sub: string;
  web_logo_url: string;
  web_favicon_url: string;
  web_meta_description: string;
  web_meta_keywords: string;
  web_footer_copyright: string;
  [key: string]: string;
}

const DEFAULT_SETTINGS: WebSettings = {
  web_title: 'DMS — Dealer Management System | REVDSTORE',
  web_brand_name: 'REVDSTORE',
  web_brand_sub: 'Dealer Retail Console',
  web_logo_url: '',
  web_favicon_url: '',
  web_meta_description: 'Platform Dealer Management System terpadu untuk penjualan motor, bot WhatsApp, dan analitik dealer.',
  web_meta_keywords: 'dealer motor, dms, sales motor, bot whatsapp, kredit motor, revdstore',
  web_footer_copyright: 'REVDSTORE'
};

interface SettingsContextType {
  settings: WebSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettingsState: (partial: Partial<WebSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  refreshSettings: async () => {},
  updateSettingsState: () => {}
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<WebSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const applyDomUpdates = (cfg: WebSettings) => {
    // 1. Update Title
    if (cfg.web_title) {
      document.title = cfg.web_title;
    }

    // 2. Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', cfg.web_meta_description || DEFAULT_SETTINGS.web_meta_description);

    // 3. Update Meta Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', cfg.web_meta_keywords || DEFAULT_SETTINGS.web_meta_keywords);

    // 4. Update Favicon if custom provided
    if (cfg.web_favicon_url) {
      let linkIcon: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!linkIcon) {
        linkIcon = document.createElement('link');
        linkIcon.rel = 'icon';
        document.head.appendChild(linkIcon);
      }
      linkIcon.href = cfg.web_favicon_url;
    }
  };

  const fetchPublicSettings = async () => {
    try {
      const res = await apiRequest('/settings/public');
      if (res.success && res.data) {
        const merged = { ...DEFAULT_SETTINGS, ...res.data };
        setSettings(merged);
        applyDomUpdates(merged);
      }
    } catch (e) {
      // Fallback to default
      applyDomUpdates(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicSettings();
  }, []);

  useEffect(() => {
    applyDomUpdates(settings);
  }, [settings.web_title, settings.web_meta_description, settings.web_meta_keywords, settings.web_favicon_url]);

  const updateSettingsState = (partial: Partial<WebSettings>) => {
    setSettings((prev) => {
      const updated: WebSettings = {
        ...prev,
        ...partial
      } as WebSettings;
      applyDomUpdates(updated);
      return updated;
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        refreshSettings: fetchPublicSettings,
        updateSettingsState
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
