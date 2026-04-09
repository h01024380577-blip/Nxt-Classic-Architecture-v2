-- AI Debate Studio 테이블 생성
--
-- 사용법:
--   (1) 전용 DB를 새로 만들 경우:
--       CREATE DATABASE debate_studio; 를 먼저 실행한 뒤 이 스크립트 실행.
--   (2) 기존 공유 DB를 사용할 경우:
--       해당 DB에 접속한 상태(USE db_25; 등)에서 이 스크립트의
--       CREATE TABLE 블록만 실행.
--
-- 테이블명은 `debate_results` 로 통일.
-- 공유 DB에서 다른 수업 테이블과 충돌할 가능성이 있으면 접두사를 붙이세요.

CREATE TABLE IF NOT EXISTS debate_results (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  topic           VARCHAR(255) NOT NULL,
  position_a      VARCHAR(255) NOT NULL,
  position_b      VARCHAR(255) NOT NULL,
  gemini_side     ENUM('a','b') NOT NULL,
  nova_side       ENUM('a','b') NOT NULL,
  user_choice     ENUM('a','b') NOT NULL,
  winner_model    ENUM('gemini','nova') NOT NULL,
  turn_count      INT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_winner (winner_model),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
