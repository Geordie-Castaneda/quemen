odoo.define('quemen.PaymentScreen', function(require) {
    'use strict';

    const Registries = require('point_of_sale.Registries');
    const PaymentScreen = require('point_of_sale.PaymentScreen');
    var { Gui } = require('point_of_sale.Gui');
    var core = require('web.core');
    const { isConnectionError } = require('point_of_sale.utils');

    var _t = core._t;


    const QuemenPaymentScreen = PaymentSreen =>
        class extends PaymentScreen {



            async validateOrder(isForceValidate) {
                // var res = super.validateOrder(...arguments);
                console.log('Validate order inherit')
                console.log(this)
                var efectivoMaximo = this.env.pos.config.efectivo_maximo;
                var sesionId = this.env.pos.pos_session.id;
                var sesion = [];
                var total_efectivo = [];
                var ventaEfectivoActual = 0;
                const order = this.currentOrder;
                var pago_efectivo = false;
                var cambio = this.currentOrder.get_change();
                var total_pago_banco = 0;
                
                if (order.get_paymentlines().length > 0){
                    order.get_paymentlines().forEach(function (line) {
                        if (line.payment_method.type == "cash"){
                            pago_efectivo = true
                        }else{
                            total_pago_banco += line.amount
                        }
                    });
  
                }

                if (pago_efectivo == false && order.get_paymentlines().length >= 1 && cambio > 0 || total_pago_banco > this.currentOrder.get_total_with_tax()){
                    return await Gui.showPopup('ErrorPopup', {
                            'title': _t("Error en pago"),
                            'body': _t("Monto de pago incorrecto"),
                        });
                }

                this.currentOrder.get_paymentlines().forEach(function (line) {
                    if (line.payment_method.is_cash_count == true){
                        ventaEfectivoActual += line.amount
                    }
                });

                try {
                    sesion = await this.rpc({
                        model: 'pos.session',
                        method: 'search_read',
                        args: [[
                            ['id', '=', sesionId]
                        ]],
                        context: this.env.session.user_context,
                    });

                } catch (error) {
                    if (isConnectionError(error)) {
                        return this.showPopup('OfflineErrorPopup', {
                            title: this.env._t('Network Error'),
                            body: this.env._t("Product is not loaded. Tried loading the product from the server but there is a network error."),
                        });
                    } else {
                        throw error;
                    }
                }
                console.log('sesion')
                console.log(sesion)

                if (sesion.length > 0){

                    var datos_sesion = sesion[0];
                    var pagos_efectivo = datos_sesion.pagos_efectivo;
                    var retiros_efectivo = datos_sesion.retiros_efectivo;
                    total_efectivo = (pagos_efectivo+ventaEfectivoActual) - retiros_efectivo;
                    console.log('total efectivo')
                    console.log(total_efectivo)
                    if (total_efectivo >= efectivoMaximo){
                        var url = "https://quemen.odoo.com/web#cids=1&menu_id=219&action=698&model=quemen.retiros_efectivo&view_type=list"
                        window.open(url, "_blank");
                        return await Gui.showPopup('ErrorPopup', {
                                'title': _t("POS error"),
                                'body': _t("Efectivo máximo en caja"),
                            });

                    }else{

                        return super.validateOrder(isForceValidate);
                    }


                }
                // if(this.env.pos.config.cash_rounding) {
                //     if(!this.env.pos.get_order().check_paymentlines_rounding()) {
                //         this.showPopup('ErrorPopup', {
                //             title: this.env._t('Rounding error in payment lines'),
                //             body: this.env._t("The amount of your payment lines must be rounded to validate the transaction."),
                //         });
                //         return;
                //     }
                // }
                // if (await this._isOrderValid(isForceValidate)) {
                //     // remove pending payments before finalizing the validation
                //     for (let line of this.paymentLines) {
                //         if (!line.is_done()) this.currentOrder.remove_paymentline(line);
                //     }
                //     await this._finalizeValidation();
                // }
            }
        };

    Registries.Component.extend(PaymentScreen, QuemenPaymentScreen);


});
