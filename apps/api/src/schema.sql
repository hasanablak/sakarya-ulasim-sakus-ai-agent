CREATE TABLE IF NOT EXISTS hatlar (
  id INT NOT NULL PRIMARY KEY,
  kod VARCHAR(32) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  ad VARCHAR(255) NOT NULL,
  bus_type_id INT NULL,
  bus_type_name VARCHAR(128) NULL,
  bus_type_color VARCHAR(16) NULL,
  asis_id INT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  last_ingested_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hatlar_slug (slug),
  KEY idx_hatlar_kod (kod)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS duraklar (
  id INT NOT NULL PRIMARY KEY,
  ad VARCHAR(255) NOT NULL,
  durak_no INT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  tip_ad VARCHAR(64) NULL,
  akilli TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hat_guzergah (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hat_id INT NOT NULL,
  sakus_route_id INT NOT NULL,
  yon_ad VARCHAR(255) NOT NULL,
  start_location VARCHAR(255) NULL,
  end_location VARCHAR(255) NULL,
  route_type_id INT NULL,
  geometry_json JSON NOT NULL,
  UNIQUE KEY uq_hat_route (hat_id, sakus_route_id),
  CONSTRAINT fk_guzergah_hat FOREIGN KEY (hat_id) REFERENCES hatlar (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hat_duraklari (
  hat_id INT NOT NULL,
  sakus_route_id INT NOT NULL,
  durak_id INT NOT NULL,
  sira INT NOT NULL,
  PRIMARY KEY (hat_id, sakus_route_id, durak_id),
  KEY idx_hat_durak_durak (durak_id),
  CONSTRAINT fk_hd_hat FOREIGN KEY (hat_id) REFERENCES hatlar (id) ON DELETE CASCADE,
  CONSTRAINT fk_hd_durak FOREIGN KEY (durak_id) REFERENCES duraklar (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hat_seferleri (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hat_id INT NOT NULL,
  sakus_route_id INT NOT NULL,
  yon_ad VARCHAR(255) NOT NULL,
  gun_kod VARCHAR(16) NOT NULL,
  ornek_tarih DATE NULL,
  day_parameter_value_id INT NULL,
  sefer_no INT NULL,
  kalkis TIME NOT NULL,
  varis TIME NULL,
  aciklama VARCHAR(255) NULL,
  UNIQUE KEY uq_sefer (hat_id, sakus_route_id, gun_kod, sefer_no, kalkis),
  KEY idx_sefer_hat_gun (hat_id, gun_kod),
  CONSTRAINT fk_sefer_hat FOREIGN KEY (hat_id) REFERENCES hatlar (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS arac_son_konum (
  bus_number INT NOT NULL PRIMARY KEY,
  hat_id INT NOT NULL,
  line_number VARCHAR(32) NULL,
  plate VARCHAR(32) NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  speed DECIMAL(8,2) NULL,
  heading DECIMAL(8,3) NULL,
  status VARCHAR(32) NULL,
  route_id INT NULL,
  route_name VARCHAR(255) NULL,
  next_stop_id INT NULL,
  next_stop_name VARCHAR(255) NULL,
  at_stop_id INT NULL,
  at_stop_name VARCHAR(255) NULL,
  eta_s DECIMAL(12,3) NULL,
  dist_next_stop_m DECIMAL(12,3) NULL,
  tracking_id BIGINT NULL,
  start_location VARCHAR(255) NULL,
  end_location VARCHAR(255) NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_arac_hat (hat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(16) NOT NULL,
  hat_slug VARCHAR(191) NULL,
  status VARCHAR(16) NOT NULL,
  progress_json JSON NULL,
  error_text TEXT NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sohbet_oturumlari (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kaynak VARCHAR(16) NOT NULL DEFAULT 'web',
  origin_lat DECIMAL(10,7) NULL,
  origin_lng DECIMAL(10,7) NULL,
  hedef_text VARCHAR(512) NULL,
  webchat_id INT NULL,
  agent_id INT NULL,
  host_origin VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sohbet_webchat (webchat_id, updated_at),
  KEY idx_sohbet_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sohbet_mesajlari (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  oturum_id CHAR(36) NOT NULL,
  rol VARCHAR(16) NOT NULL,
  icerik TEXT NOT NULL,
  meta_json JSON NULL,
  tool_ad VARCHAR(64) NULL,
  fonksiyon_kod VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_msg_oturum (oturum_id, id),
  KEY idx_msg_rol (oturum_id, rol),
  CONSTRAINT fk_msg_oturum FOREIGN KEY (oturum_id) REFERENCES sohbet_oturumlari (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kullanici_olaylari (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  oturum_id CHAR(36) NULL,
  tool_ad VARCHAR(64) NULL,
  fonksiyon_kod VARCHAR(64) NOT NULL,
  input_json JSON NULL,
  ok TINYINT(1) NOT NULL DEFAULT 1,
  sure_ms INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_olay_fn (fonksiyon_kod, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS toollar (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ad VARCHAR(64) NOT NULL,
  aciklama TEXT NOT NULL,
  fonksiyon_kod VARCHAR(64) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tool_ad (ad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agentler (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ad VARCHAR(128) NOT NULL,
  aciklama TEXT NULL,
  sistem_prompt TEXT NOT NULL,
  llm_saglayici VARCHAR(32) NOT NULL DEFAULT 'openai',
  model VARCHAR(128) NOT NULL DEFAULT 'gpt-4o-mini',
  api_token TEXT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_toollar (
  agent_id INT NOT NULL,
  tool_id INT NOT NULL,
  PRIMARY KEY (agent_id, tool_id),
  CONSTRAINT fk_at_agent FOREIGN KEY (agent_id) REFERENCES agentler (id) ON DELETE CASCADE,
  CONSTRAINT fk_at_tool FOREIGN KEY (tool_id) REFERENCES toollar (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webchatler (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ad VARCHAR(128) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  agent_id INT NULL,
  baslik VARCHAR(128) NOT NULL DEFAULT 'SAKUS sohbet',
  karsilama TEXT NULL,
  placeholder VARCHAR(191) NULL,
  fab_ac VARCHAR(32) NULL,
  fab_kapat VARCHAR(32) NULL,
  konum VARCHAR(16) NOT NULL DEFAULT 'sag_alt',
  tema_json JSON NOT NULL,
  embed_key CHAR(36) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  varsayilan TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webchat_slug (slug),
  UNIQUE KEY uq_webchat_embed (embed_key),
  KEY idx_webchat_varsayilan (varsayilan, aktif),
  CONSTRAINT fk_webchat_agent FOREIGN KEY (agent_id) REFERENCES agentler (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
