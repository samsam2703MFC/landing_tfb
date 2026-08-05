-- §21 — packs (Stripe products), their prices, their composition, and the
-- derogations that open or close a module outside the pack.
--
-- Licences, stores and tenants stay in the billing service. tfb_license_overrides
-- carries that service's licence id as a plain VARCHAR with no foreign key: the
-- boundary is deliberate, and a FK across it would be a lie.

-- CreateTable
CREATE TABLE `tfb_packs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(80) NOT NULL,
    `stripe_product_id` VARCHAR(120) NULL,
    `kind` VARCHAR(20) NOT NULL DEFAULT 'subscription',
    `icon` VARCHAR(60) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tfb_packs_key_key`(`key`),
    UNIQUE INDEX `tfb_packs_stripe_product_id_key`(`stripe_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tfb_pack_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pack_id` INTEGER NOT NULL,
    `stripe_price_id` VARCHAR(120) NOT NULL,
    `amount` INTEGER NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
    `interval` VARCHAR(20) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tfb_pack_prices_stripe_price_id_key`(`stripe_price_id`),
    INDEX `tfb_pack_prices_pack_id_idx`(`pack_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tfb_pack_modules` (
    `pack_id` INTEGER NOT NULL,
    `module_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tfb_pack_modules_module_id_idx`(`module_id`),
    PRIMARY KEY (`pack_id`, `module_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tfb_license_overrides` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `license_id` VARCHAR(64) NOT NULL,
    `module_id` INTEGER NOT NULL,
    `grant` BOOLEAN NOT NULL,
    `reason` TEXT NOT NULL,
    `expires_at` DATETIME(3) NULL,
    `created_by` VARCHAR(150) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,
    `revoked_by` VARCHAR(150) NULL,

    INDEX `tfb_license_overrides_license_id_idx`(`license_id`),
    INDEX `tfb_license_overrides_module_id_idx`(`module_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tfb_pack_prices` ADD CONSTRAINT `tfb_pack_prices_pack_id_fkey` FOREIGN KEY (`pack_id`) REFERENCES `tfb_packs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tfb_pack_modules` ADD CONSTRAINT `tfb_pack_modules_pack_id_fkey` FOREIGN KEY (`pack_id`) REFERENCES `tfb_packs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tfb_pack_modules` ADD CONSTRAINT `tfb_pack_modules_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `tfb_modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tfb_license_overrides` ADD CONSTRAINT `tfb_license_overrides_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `tfb_modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
