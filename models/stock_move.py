# -*- coding: utf-8 -*-
from odoo import api, fields, models, SUPERUSER_ID, _
from odoo.exceptions import UserError, ValidationError
import logging
import pytz
from datetime import datetime

class StockMove(models.Model):
    _inherit = "stock.move"


    def _search_picking_for_assignation(self):
        res = super(StockMove, self)._search_picking_for_assignation()
        res = False
        return res

class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    barcode = fields.Char('Código de barra')
    cantidad_etiquetas = fields.Float('Cantidad etiquetas')

    @api.onchange('barcode')
    def _onchange_barcode(self):
        for line in self:
            if line.barcode:
                lot_id = self.env['stock.production.lot'].search([('name','=',line.barcode)])
                if len(lot_id) > 0:
                    lot_info = False
                    if len(lot_id) == 1:
                        lot_info = lot_id[0]
                    if len(lot_id) > 1:
                        for lot in lot_id:
                            if lot.product_id.producto_porciones:
                                lot_info = lot
                    line.product_id = lot_info.product_id.id
                    line.lot_id = lot_info.id
                    line.qty_done = 1
                else:
                    raise ValidationError(_("Código de barra inválido"))
