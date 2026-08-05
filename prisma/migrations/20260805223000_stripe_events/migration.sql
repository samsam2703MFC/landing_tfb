-- §18 — the events Stripe has delivered, by their own id.
--
-- Stripe redelivers until it receives a 2xx, so the same event arrives more than
-- once as a matter of course. The unique index is what makes the second delivery a
-- recognised no-op instead of a second write.
--
-- `created` is Stripe's timestamp, kept because delivery order is not guaranteed:
-- an older customer.subscription.updated overtaking a newer one would roll a
-- subscription's status backwards, and comparing this field is what prevents it.

-- CreateTable
CREATE TABLE `tfb_stripe_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stripe_event_id` VARCHAR(120) NOT NULL,
    `type` VARCHAR(120) NOT NULL,
    `created` INTEGER NOT NULL,
    `outcome` VARCHAR(20) NOT NULL,
    `detail` VARCHAR(255) NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tfb_stripe_events_stripe_event_id_key`(`stripe_event_id`),
    INDEX `tfb_stripe_events_received_at_idx`(`received_at`),
    INDEX `tfb_stripe_events_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The guard against out-of-order delivery: the Stripe timestamp of the last event
-- applied to this subscription. An event older than this one is stale.
ALTER TABLE `tfb_subscriptions` ADD COLUMN `last_event_created` INTEGER NULL;
