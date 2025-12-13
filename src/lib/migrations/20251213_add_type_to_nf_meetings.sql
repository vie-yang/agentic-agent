ALTER TABLE nf_meetings ADD COLUMN type ENUM('offline', 'online') DEFAULT 'offline' AFTER title;
