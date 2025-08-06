from odoo import fields, models

class PosPaymentMethod(models.Model):
    _inherit = "pos.payment.method"


    is_voucher = fields.Boolean(
        string='Is Meal Or Gift  Voucher',
        help='This payment method accepts restaurant vouchers or gift vouchers.'
    )
    rate_retention = fields.Float(string='Retention Rate (%)')

    def _load_pos_data_fields(self, config_id):
        result = super()._load_pos_data_fields(config_id)
        result.extend(['is_voucher', 'rate_retention'])
        return result


