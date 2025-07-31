odoo.define('quemen.ProductScreen', function(require) {
    'use strict';

    const Registries = require('point_of_sale.Registries');
    const ProductScreen = require('point_of_sale.ProductScreen');
    // const PosCouponProductScreen = require('pos_coupon.PosCouponProductScreen')
    var { Gui } = require('point_of_sale.Gui');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    var core = require('web.core');
    var _t = core._t;

    // const QeuemenPosCouponProductScreen = PosCouponProductScreen =>
    //     class extends PosCouponProductScreen {
    //         constructor(obj, options) {
    //             super(...arguments);
    //         }

    //         async _updateSelectedOrderline(event) {
    //             const selectedLine = this.currentOrder.get_selected_orderline();
    //             if (selectedLine && selectedLine.is_program_reward && event.detail.key === 'Backspace') {
    //                 console.log('intenta inactivar pero no lo hace')
    //                 return super._updateSelectedOrderline(...arguments);
    //             }else{
    //                 return super._updateSelectedOrderline(...arguments);
    //             }

    //         }

    //     };

    // Registries.Component.extend(PosCouponProductScreen, QeuemenPosCouponProductScreen);

    const QuemenProductScreen = ProductScreen =>
        class extends ProductScreen {
            constructor(obj, options) {
                super(...arguments);
            }

            async _clickProduct(event) {
                const productSelected = event.detail;
                var productLot = [];
                var location_id = this.env.pos.config.ubicacion_id[0];
                var lot_list = []
                var optionsProduct = await this._getAddProductOptions(productSelected);
                if (productSelected.tracking == "lot"){
                    productLot = await this.rpc({
                        model: 'stock.quant',
                        method: 'search_read',
                        args: [[
                            ['product_id', '=', productSelected.id],
                            ['location_id', '=', location_id]
                        ]],
                        context: this.env.session.user_context,
                    });                    
                    if (productLot.length > 0){
                        productLot.forEach(result => {

                            lot_list.push({'id': result.lot_id[0],'label': 'Lote: ' + result.lot_id[1] + ' Disponible: ' + result.quantity.toString()  + ' CAD: ' + result.removal_date.toString(), isSelected: false, item: result})
                        });
                        
                        const { confirmed, payload } = await this.showPopup('SelectionPopup', {
                            title: this.env._t('Seleccione un Lote'),
                            list: lot_list,
                            confirmText: this.env._t('Aceptar'),
                        });
                        if (confirmed) {
                            var optionsProduct = {'descrption': false, 'draftPackLotLines': {'newPackLotLines': [{'lot_name': payload.lot_id[1]}]},'pirce_extra':0 }
                            await this.currentOrder.add_product(productSelected, optionsProduct);
                            NumberBuffer.reset();
                        }
                        
                        
                    }else{
                        return
                    }
                    
                }else{
                    var actionClickProduct = super._clickProduct(...arguments);
                    return actionClickProduct
                }

            }

            async _getLots(product, location){
                
            }
            
            async _barcodeProductAction(code){
                const product = await this._getProductByBarcode(code);
                if (!product) {
                    return false;
                }

                var action = super._barcodeProductAction(...arguments);
                return action
            }


            async _onClickPay() {
                // var lote_existe = await this.verificarLote(a,b,c)
                var lote_invalido = false;


                var ubicacion_id = this.env.pos.config.ubicacion_id[0];

                const stock_quant = await this.lineasLote(this.env.pos.get_order().orderlines, ubicacion_id);
                if (stock_quant.length > 0){
                    
                    if (stock_quant[0].length > 0 && stock_quant[0] != false){
                        return this.showPopup('ErrorPopup', {
                            title: this.env._t('Error en lote'),
                            body: this.env._t( stock_quant[0].toString() ),
                        });
                    }
                    if (stock_quant[1].length > 0 && stock_quant[1] != false){
                        return this.showPopup('ErrorPopup', {
                            title: this.env._t('Producto sin existencia , Revisar inventario'),
                            body: this.env._t(stock_quant[1].toString()),
                        });
                    }

                }

                if (this.env.pos.get_order().orderlines.any(line => line.get_quantity() == 0)) {
                    const { confirmed } = await this.showPopup('ConfirmPopup', {
                        title: this.env._t('Cnatidad 0'),
                        body: this.env._t('No puede dejar lines con cantidad CERO'),
                        confirmText: this.env._t('Aceptar'),
                    });
                    if (confirmed) {
                        return;
                    }
                }else{
                    var action = super._onClickPay(...arguments);
                    return action;
                }

            }
            async lineasLote(lineas, ubicacion_id){
                var products_order = [];
                var productos = []
                lineas.forEach(line => {
                    if (line.get_lot_lines()) {
                        const lote_existe = false;

                        var lot_name = line.get_lot_lines()[0].attributes.lot_name
                        var product = line.get_product()
                        products_order.push({'lote': lot_name, 'producto': product.id , 'qty': line.get_quantity() });

                        productos.push(product.id)
                        // lote_existe = await this.verificarLote(lot_name, ubicacion_id, product)
                        // console.log('lote_existe')
                        // console.log(lote_existe)
                        // if (lote_existe.length > 0){
                        //     draftPackLotLines = { modifiedPackLotLines, newPackLotLines };
                        // }else {
                        //     const { confirmed, payload } = Gui.showPopup('ErrorPopup', {
                        //                             'title': 'Número de serie inválido '+ lot_name,
                        //                         });
                        //     return ;
                        // }

                    }else{
                        var product = line.get_product()
                        if (product.lst_price > 0){
                            products_order.push({'lote': false, 'producto': product.id, 'qty': line.get_quantity()});
                            productos.push(product.id)                            
                            
                        }

                    }
                })

                const stock_quant = await this.verificarLote(products_order, ubicacion_id,productos)
                return stock_quant

            }

            async verificarLote(products_order, ubicacion_id){
                return await this.rpc({
                    model: 'pos.order',
                    method: 'buscar_inventario',
                    args: [[], products_order,ubicacion_id],
                })
            }
            async _getAddProductOptions(product, base_code) {
                let price_extra = 0.0;
                var self = this;
                let draftPackLotLines, weight, description, packLotLinesToEdit;
                if (_.some(product.attribute_line_ids, (id) => id in this.env.pos.attributes_by_ptal_id)) {
                    let attributes = _.map(product.attribute_line_ids, (id) => this.env.pos.attributes_by_ptal_id[id])
                                      .filter((attr) => attr !== undefined);
                    let { confirmed, payload } = await this.showPopup('ProductConfiguratorPopup', {
                        product: product,
                        attributes: attributes,
                    });

                    if (confirmed) {
                        description = payload.selected_attributes.join(', ');
                        price_extra += payload.price_extra;
                    } else {
                        return;
                    }
                }

                // Gather lot information if required.
                if (['serial', 'lot'].includes(product.tracking) && (this.env.pos.picking_type.use_create_lots || this.env.pos.picking_type.use_existing_lots)) {
                    const isAllowOnlyOneLot = product.isAllowOnlyOneLot();
                    if (isAllowOnlyOneLot) {
                        packLotLinesToEdit = [{"lot_name": "0013898"}];
                    } else {
                        const orderline = this.currentOrder
                            .get_orderlines()
                            .filter(line => !line.get_discount())
                            .find(line => line.product.id === product.id);
                        if (orderline) {
                            packLotLinesToEdit = orderline.getPackLotLinesToEdit();
                        } else {
                            packLotLinesToEdit = [{"lot_name": "0013898"}];
                        }
                    }
                    if (base_code && "code" in base_code){
                        draftPackLotLines = {'newPackLotLines': [{'lot_name': base_code.code}]}
                    }
                    
                    // const { confirmed, payload } = await this.showPopup('EditListPopup', {
                    //     title: this.env._t('Lot/Serial Number(s) Required'),
                    //     isSingleItem: isAllowOnlyOneLot,
                    //     array: packLotLinesToEdit,
                    // });

                    // if (confirmed) {
                    //     // Segregate the old and new packlot lines
                    //     const modifiedPackLotLines = Object.fromEntries(
                    //         payload.newArray.filter(item => item.id).map(item => [item.id, item.text])
                    //     );
                    //     const newPackLotLines = payload.newArray
                    //         .filter(item => !item.id)
                    //         .map(item => ({ lot_name: item.text }));
                    //     console.log("newPackLotLines")
                    //     console.log(newPackLotLines)

                    //     var ubicacion_id = this.env.pos.config.warehouse_id[0];
                    //     var lot_name = newPackLotLines[0].lot_name
                    //     console.log("el producto")
                    //     console.log(product)
                    //     var nuevo_dic = [{"producto": product.id, "lote": lot_name, "qty": 1}]
                    //     var lote_existe = await this.verificarLote(nuevo_dic, ubicacion_id)

                    //     if (lote_existe.length > 0){
                    //         draftPackLotLines = { modifiedPackLotLines, newPackLotLines };
                    //     }else {
                    //         const { confirmed, payload } = Gui.showPopup('ErrorPopup', {
                    //                                 'title': 'Número de serie inválido '+ lot_name,
                    //                             });
                    //         return ;
                    //     }

                    // } else {
                    //     // We don't proceed on adding product.
                    //     return;
                    // }


                }

                // Take the weight if necessary.
                if (product.to_weight && this.env.pos.config.iface_electronic_scale) {
                    // Show the ScaleScreen to weigh the product.
                    if (this.isScaleAvailable) {
                        const { confirmed, payload } = await this.showTempScreen('ScaleScreen', {
                            product,
                        });
                        if (confirmed) {
                            weight = payload.weight;
                        } else {
                            // do not add the product;
                            return;
                        }
                    } else {
                        await this._onScaleNotAvailable();
                    }
                }

                if (base_code && this.env.pos.db.product_packaging_by_barcode[base_code.code]) {
                    weight = this.env.pos.db.product_packaging_by_barcode[base_code.code].qty;
                }
                
                return { draftPackLotLines, quantity: weight, description, price_extra };

            }

            async _getProductByBarcode(code) {
                const lotes = this.env.pos.lot_dict || {};
                console.log("_getProductByBarcode");
                console.log("code", code);
            
                const lote_data = lotes[code.base_code];  // Buscar por nombre del lote
            
                if (lote_data) {
                    console.log("✅ Lote encontrado en cache:", lote_data);
            
                    const product_id = lote_data.product_id;
            
                    // Agregar producto directamente sin verificar stock
                    await this.env.pos._addProducts([product_id], false);
                    const product_barcode = this.env.pos.db.get_product_by_id(product_id);
                    return product_barcode;
            
                } else {
                    await this.showPopup('ErrorPopup', {
                        title: this.env._t("POS error"),
                        body: this.env._t(`❌ Lote no encontrado: ${code.base_code}`),
                    });
                    console.warn("❌ Lote no encontrado en cache: ", code.base_code);
                    return false;
                }
            }

        };

    Registries.Component.extend(ProductScreen, QuemenProductScreen);


});
