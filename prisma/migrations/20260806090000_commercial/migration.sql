-- §15–§17 — agents B2B, their negotiated splits, and the commercial settings.
--
-- `tenant_slug` on tfb_agent_assignments is the billing service's own identifier,
-- stored as a plain VARCHAR with no foreign key: that service owns tenants, and a
-- FK across the boundary would be a lie. Same reasoning as tfb_license_overrides.
--
-- Rates are basis points (9000 = 90,00 %), never floats: money computed from a
-- float is money that disagrees with itself at the fourth decimal.
--
-- Offers are not a table here — an offer *is* a pack. §15 adds nothing but the
-- `purchase` kind to tfb_packs.kind, which needs no schema change.

-- CreateTable
CREATE TABLE `tfb_agents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `kind` VARCHAR(20) NOT NULL DEFAULT 'commercial',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tfb_agents_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tfb_commission_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(80) NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tfb_commission_plans_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
-- One row per step: from this many months of seniority, this rate. The unique
-- index is what stops a plan from holding two rates for the same month — which
-- would make the calculation depend on row order.
CREATE TABLE `tfb_commission_tiers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `from_month` INTEGER NOT NULL,
    `percent_bp` INTEGER NOT NULL,

    INDEX `tfb_commission_tiers_plan_id_idx`(`plan_id`),
    UNIQUE INDEX `uq_tier_start`(`plan_id`, `from_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
-- `ended_at` rather than deletion: a closed assignment still explains the
-- commissions paid while it was open.
CREATE TABLE `tfb_agent_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agent_id` INTEGER NOT NULL,
    `tenant_slug` VARCHAR(120) NOT NULL,
    `pack_key` VARCHAR(80) NULL,
    `plan_id` INTEGER NULL,
    `started_at` DATETIME(3) NOT NULL,
    `ended_at` DATETIME(3) NULL,
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tfb_agent_assignments_agent_id_idx`(`agent_id`),
    INDEX `tfb_agent_assignments_tenant_slug_idx`(`tenant_slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tfb_sales_stages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(80) NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tfb_sales_stages_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
-- `amount` in cents, like every other amount here. NULL = quoted case by case,
-- which is not the same as free.
CREATE TABLE `tfb_services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(80) NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `amount` INTEGER NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tfb_services_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tfb_billing_entities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(80) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `vat_number` VARCHAR(40) NULL,
    `address` VARCHAR(255) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tfb_billing_entities_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tfb_commission_tiers` ADD CONSTRAINT `tfb_commission_tiers_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `tfb_commission_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tfb_agent_assignments` ADD CONSTRAINT `tfb_agent_assignments_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `tfb_agents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL, not CASCADE: deleting a plan must not delete the record that an agent
-- held a client. The assignment survives, plan-less and visibly so.
ALTER TABLE `tfb_agent_assignments` ADD CONSTRAINT `tfb_agent_assignments_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `tfb_commission_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
