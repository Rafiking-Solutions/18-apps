
from odoo import models ,fields ,api

class PosPayment(models.Model):
    _inherit = 'pos.payment'

    is_voucher = fields.Boolean(
        string='Is Meal Or Gift  Voucher',related="payment_method_id.is_voucher",
        help='This payment method accepts restaurant vouchers or gift vouchers.'
    )
    voucher_ids = fields.One2many('pos.voucher', 'pos_payment_id', string='Vouchers')
    voucher_count = fields.Integer(string='Voucher Count', compute='_compute_voucher_count')

    @api.depends('voucher_ids')
    def _compute_voucher_count(self):
        for payment in self:
            payment.voucher_count = len(payment.voucher_ids)

    def action_view_vouchers(self):
        self.ensure_one()
        return {
            'name': 'Vouchers',
            'type': 'ir.actions.act_window',
            'res_model': 'pos.voucher',
            'view_mode': 'list,form',
            'domain': [('pos_payment_id', '=', self.id)],
            'context': {
                'default_pos_payment_id': self.id,
                'default_pos_order_id': self.pos_order_id.id if self.pos_order_id else False,
                'default_payment_method_id': self.payment_method_id.id if self.payment_method_id else False,
            }
        }










