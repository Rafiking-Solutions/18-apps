/** @odoo-module */
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

import { Dialog } from "@web/core/dialog/dialog";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { Component, useState, useRef, onMounted, onWillUnmount } from "@odoo/owl";

export class PosVoucherPopup extends Component {
    static template = "pos_meal_and_gift_voucher.PosVoucherPopup";
    static components = { Dialog };

    static props = {
        paymentMethod: { type: Object, optional: true },
        resolve: { type: Function, optional: true },
        reject: { type: Function, optional: true },
        close: { type: Function },
        title: { type: String, optional: true },
        getPayload: { type: Function, optional: true },
    };

    setup() {
        super.setup();
        this.pos = usePos();
        this.notification = useService("notification");
        this.barcode = useService("barcode");
        this.ticketInputRef = useRef("ticketInput");
        this.amountInputRef = useRef("amountInput");
        const currentOrder = this.pos.get_order();
        const remainingToPay = currentOrder ? (currentOrder.get_total_with_tax() - currentOrder.get_total_paid()) : 0;
        this.originalBarcodeHandler = null;

        this.state = useState({
            Tickets: [],
            currentTicket: '',
            currentAmount: '',
            totalOriginal: 0,
            totalRetention: 0,
            totalNet: 0,
            retentionRate: this.props.paymentMethod?.rate_retention || 0,
            remainingToPay: remainingToPay,
            remainingAmount: remainingToPay,
            isScanMode : false,
        });

        onMounted(() => {
            if (this.amountInputRef.el) {
                this.amountInputRef.el.focus();
            }
            this._disableOdooBarcodeHandler();
            this.barcode.bus.addEventListener("barcode_scanned", this._onBarcodeScanned, {
                capture: true,
                passive: false
            });
            window.addEventListener("barcode_scanned", this._onBarcodeScanned, {
                capture: true,
                passive: false
            });
        });

        onWillUnmount(() => {
            this.barcode.bus.removeEventListener("barcode_scanned", this._onBarcodeScanned, { capture: true });
            window.removeEventListener("barcode_scanned", this._onBarcodeScanned, { capture: true });
            this._restoreOdooBarcodeHandler();
        });
    }

    _disableOdooBarcodeHandler() {
        try {
            if (this.pos && this.pos.barcodeReader) {
                this.originalBarcodeHandler = this.pos.barcodeReader.scan;
                this.pos.barcodeReader.scan = () => {
                    console.log("Odoo barcode handler disabled");
                    return false;
                };
            }
        } catch (error) {
            console.error("Error disabling Odoo barcode handler:", error);
        }
    }

    _restoreOdooBarcodeHandler() {
        try {
            if (this.pos && this.pos.barcodeReader && this.originalBarcodeHandler) {
                this.pos.barcodeReader.scan = this.originalBarcodeHandler;
            }
        } catch (error) {
            console.error("Error restoring Odoo barcode handler:", error);
        }
    }

    _onBarcodeScanned = (event) => {
        const barcode = event.detail.barcode;
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
        if (event.detail) {
            event.detail.handled = true;
            event.detail.stopped = true;
            event.detail.processed = true;
        }
        event.handled = true;
        event.stopped = true;
        event.processed = true;
        if (barcode && barcode.length >= 20) {
            this._barcodeVoucherAction({ code: barcode });
        } else {
            console.log("Barcode too short for voucher, ignoring silently");
        }
        return false;
    }

    onInputKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.processInput();
        }
    }

    processInput() {
        const input = this.state.currentTicket.trim();
        if (input.length > 20) {
            this._barcodeVoucherAction({ code: input });
        } else {
            this.addManualTicket();
        }
    }

    onAmountKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.addManualTicket();
        }
    }

    async _barcodeVoucherAction(code) {
        try {
            const parsed = this._parseVoucherBarcode(code.code);
            if (!parsed) {
                this.notification.add(_t("Invalid voucher barcode format"), { type: "warning" });
                return;
            }
            const alreadyUsed = this.state.Tickets.some(ticket => ticket.code === parsed.identifier);
            if (alreadyUsed) {
                this.notification.add(_t("This voucher has already been scanned."), { type: "warning" });
                return;
            }
            const scannedTicket = this.createScannedTicket(
                parsed.amount,
                parsed.identifier,
                this.state.retentionRate
            );
            this.addScannedTicket(scannedTicket);
            this.notification.add(_t("Voucher scanned successfully"), { type: "success" });
            this.state.currentTicket = '';

        } catch (error) {
            console.error("Error processing voucher barcode:", error);
            this.notification.add(_t("Error processing voucher"), { type: "danger" });
        }
    }

    _parseVoucherBarcode(barcode) {
        if (!barcode || barcode.length < 20) {
            return null;
        }
        try {
            const identifier = barcode.substring(13, 21);
            const amountStr = barcode.substring(3, 9);
            const amount = parseInt(amountStr) / 1000;
            if (isNaN(amount) || amount <= 0) {
                return null;
            }
            return {
                identifier: identifier,
                amount: amount,
                fullCode: barcode
            };
        } catch (error) {
            console.error("Error parsing barcode:", error);
            return null;
        }
    }

    createScannedTicket(amount, identifier, retentionRate) {
        const retentionAmount = amount * (retentionRate / 100);
        const netAmount = amount - retentionAmount;
        return {
            code: identifier,
            originalAmount: amount,
            retentionAmount: retentionAmount,
            retentionRate: retentionRate,
            netAmount: netAmount,
            isManual: false,
            timestamp: new Date().toISOString()
        };
    }

    addScannedTicket(ticket) {
        if (this.validateTicket(ticket)) {
            this.state.Tickets.push(ticket);
            this.updateTotals();
        }
    }

    validateTicket(ticketData) {
        return ticketData && ticketData.code && ticketData.originalAmount > 0;
    }

    formatTicketData(ticketData, retentionRate) {
        const originalAmount = ticketData.amount || 0;
        const retentionAmount = originalAmount * (retentionRate / 100);
        const netAmount = originalAmount - retentionAmount;

        return {
            code: ticketData.code,
            originalAmount: originalAmount,
            retentionAmount: retentionAmount,
            retentionRate: retentionRate,
            netAmount: netAmount,
            isManual: false,
            timestamp: new Date().toISOString()
        };
    }

    addManualTicket() {
        const amount = parseFloat(this.state.currentAmount);
        if (!amount || amount <= 0) {
            this.notification.add(_t("Please enter a valid amount"), { type: "warning" });
            return;
        }
        const code = this.state.currentTicket.trim();
        if (!code) {
        this.notification.add(_t("Please enter a voucher code"), { type: "warning" });
        return;
      }
        const alreadyUsed = this.state.Tickets.some(ticket => ticket.code === code);
        if (alreadyUsed) {
            this.notification.add(_t("This voucher has already been added."), { type: "warning" });
            return;
        }
        const manualTicket = this.createManualTicket(amount, code, this.state.retentionRate);
        this.addScannedTicket(manualTicket);
        this.state.currentAmount = '';
        this.state.currentTicket = '';
        this.amountInputRef.el.focus();
    }

    createManualTicket(amount, code, retentionRate) {
        const retentionAmount = amount * (retentionRate / 100);
        const netAmount = amount - retentionAmount;

        return {
            code: code,
            originalAmount: amount,
            retentionAmount: retentionAmount,
            retentionRate: retentionRate,
            netAmount: netAmount,
            isManual: true,
            timestamp: new Date().toISOString()
        };
    }
    removeTicket(index) {
        if (index >= 0 && index < this.state.Tickets.length) {
            this.state.Tickets.splice(index, 1);
            this.updateTotals();
        }
    }
    updateTotals() {
        this.state.totalOriginal = this.state.Tickets.reduce(
            (sum, ticket) => sum + ticket.originalAmount, 0
        );
        this.state.totalRetention = this.state.Tickets.reduce(
            (sum, ticket) => sum + ticket.retentionAmount, 0
        );
        this.state.totalNet = this.state.Tickets.reduce(
            (sum, ticket) => sum + ticket.netAmount, 0
        );
        this.state.remainingAmount = this.state.remainingToPay - this.state.totalNet;
    }

    async confirm() {
        if (this.state.Tickets.length === 0) {
            this.notification.add(_t("Please scan or add at least one ticket"), { type: "warning" });
            return;
        }

        const payload = {
            voucherData: this.state.Tickets,
            totalNet: this.state.totalNet,
        };

        this.props.getPayload(payload);
        this.props.close();
    }

    cancel() {
        if (this.props.reject) {
            this.props.reject(false);
        }
        this.props.close();
    }

    formatCurrency(amount) {
        return this.pos.currency.symbol + " " + amount.toFixed(2);
    }
}

registry.category("popups").add("PosVoucherPopup", PosVoucherPopup);