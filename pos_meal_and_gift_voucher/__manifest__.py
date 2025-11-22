{
    "name": "Point Of Sale - Meal & Gift Voucher",
    "summary": "Handle meal and gift vouchers in Point of Sale",
    "version": "18.0.1.0.0",
    "category": "Point of Sale",
    "author": "Rafiking Solutions",
    "website": "https://www.rafikingsolutions.com",
    "license": "OPL-1",
    "price": 170.00,
    "depends": [
        "point_of_sale",
    ],
    'tags': [
        'pos',
        'meal voucher',
        'gift voucher',
        'ticket restaurant',
        'chèque repas',
        'chèque cadeau',
        'payment method',
        'barcode scanner',
        'retention rate'
    ],
    "data": [
        "security/ir.model.access.csv",
        "views/pos_payment_method_view.xml",
        "views/pos_payment_view.xml",
        "views/pos_voucher_view.xml",


    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_meal_and_gift_voucher/static/src/scss/*.scss",
            "pos_meal_and_gift_voucher/static/src/Screens/pos_payment_screen.js",
            "pos_meal_and_gift_voucher/static/src/Popups/pos_voucher.js",
            "pos_meal_and_gift_voucher/static/src/Popups/pos_voucher_popup.xml",




        ],
    },

    'images': ['static/images/banner.png'],

}
