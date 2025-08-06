
from odoo import models ,fields ,api
from odoo.tools import formatLang

class PosVoucher(models.Model):
    _name = 'pos.voucher'
    _inherit = ['pos.load.mixin']
    _description = 'POS Voucher'
    _order = "datetime desc"

    pos_session_id = fields.Many2one('pos.session', string='POS Session',required=True,readonly=True)
    pos_order_id = fields.Many2one('pos.order', string='Order',required=True,readonly=True)
    pos_payment_id = fields.Many2one('pos.payment', string='Payment',required=True,readonly=True)
    payment_method_id = fields.Many2one('pos.payment.method', string='Payment Method',required=True,readonly=True)
    voucher_code = fields.Char(string='Voucher Number')
    original_amount = fields.Monetary(string='Original Amount',currency_field='currency_id',tracking=True)
    retention_rate = fields.Float(string='Retention Rate (%)',readonly=True)
    retention_amount = fields.Monetary(string='Retention Amount',currency_field='currency_id',compute="_compute_retention_amount")
    net_amount = fields.Monetary(string='Net Amount',currency_field='currency_id',readonly=True,compute="_compute_net_amount")
    datetime = fields.Datetime(string='DateTime', default=fields.Datetime.now,readonly=True)
    currency_id = fields.Many2one('res.currency', string='Currency', related='pos_order_id.currency_id')
    name = fields.Char("Nom",compute="_compute_name")
    is_manual = fields.Boolean("Is Manual?")

    @api.depends('net_amount', 'currency_id')
    def _compute_name(self):
        for voucher in self:
            if not voucher.name:
                voucher.name = formatLang(self.env, voucher.net_amount, currency_obj=voucher.currency_id)

    @api.depends('original_amount', 'retention_rate')
    def _compute_retention_amount(self):
        for voucher in self:
            voucher.retention_amount = voucher.original_amount * (voucher.retention_rate / 100)

    @api.depends('original_amount', 'retention_amount')
    def _compute_net_amount(self):
        for voucher in self:
            voucher.net_amount = voucher.original_amount - voucher.retention_amount




