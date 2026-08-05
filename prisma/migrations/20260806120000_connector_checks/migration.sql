-- §19 — the result of each connector probe.
--
-- A live dashboard answers "is it broken now". The question actually asked is
-- "since when", and "did it flap or has it been down all week". One row per probe
-- answers both; a screen that only reads the present cannot.
--
-- `detail` is one line for a human — never a payload, never a response body. Those
-- carry customer data and credentials, and this table is read on a screen that
-- gets shared.

-- CreateTable
CREATE TABLE `tfb_connector_checks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `connector` VARCHAR(60) NOT NULL,
    `outcome` VARCHAR(20) NOT NULL,
    `detail` VARCHAR(255) NULL,
    `duration_ms` INTEGER NULL,
    `trigger` VARCHAR(20) NOT NULL DEFAULT 'page',
    `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tfb_connector_checks_connector_checked_at_idx`(`connector`, `checked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
