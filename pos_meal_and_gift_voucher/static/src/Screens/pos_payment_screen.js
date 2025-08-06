/** @odoo-module */
import { _t } from "@web/core/l10n/translation";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";
import { makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";
import { PosVoucherPopup } from "@pos_meal_and_gift_voucher/Popups/pos_voucher";
import { useService } from "@web/core/utils/hooks";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
    },
    async addNewPaymentLine(paymentMethod) {
        if (paymentMethod.is_voucher) {
            try {
                const payload = await makeAwaitable(this.dialog, PosVoucherPopup, {
                    title: _t("Meal & Gift Voucher"),
                    paymentMethod: paymentMethod
                });
                if (payload) {
                    this.currentOrder.add_paymentline(paymentMethod);
                    const paymentLine = this.currentOrder.get_selected_paymentline();
                    paymentLine.set_amount(payload.totalNet);
                    paymentLine.voucherData = payload.voucherData;
                    paymentLine.hasVouchersToSave = true;
                }
                this.render();

            } catch (error) {
                console.error("Error processing voucher payment:", error);
            }
        } else {
            super.addNewPaymentLine(paymentMethod);
        }
    },

    async finalizeVoucherPayments() {
        const currentOrder = this.pos.get_order();
        const voucherPayments = currentOrder.payment_ids.filter(
            line => line.payment_method_id.is_voucher && line.voucherData && line.hasVouchersToSave
        );
        for (const paymentLine of voucherPayments) {
            if (!paymentLine.voucherRecordIds) {
                await this.createVoucherRecordsForPayment(currentOrder, paymentLine);
            }
        }
    },

    async createVoucherRecordsForPayment(order, paymentLine) {
        try {
            const orderId = order.server_id || order.id;
            const voucherRecords = paymentLine.voucherData.map(voucher => ({
                payment_method_id: paymentLine.payment_method_id.id,
                voucher_code: voucher.code,
                original_amount: voucher.originalAmount,
                retention_amount: voucher.retentionAmount,
                retention_rate: voucher.retentionRate,
                net_amount: voucher.netAmount,
                pos_payment_id: paymentLine.id,
                pos_session_id : order.session_id.id,
                pos_order_id: orderId,
                is_manual: voucher.isManual,
            }));
            const createdVouchers = await this.orm.call(
                "pos.voucher",
                "create",
                [voucherRecords]
            );
            paymentLine.voucherRecordIds = createdVouchers;
            paymentLine.hasVouchersToSave = false;
            return createdVouchers;
        } catch (error) {
            console.error("Error creating voucher records for payment:", error);
            throw error;
        }
    },

    async validateOrder(isForceValidate) {
        try {
            const result = await super.validateOrder(isForceValidate);
            await this.finalizeVoucherPayments();
            return result;
        } catch (error) {
            console.error("Error during order validation:", error);
            throw error;
        }
    }
});