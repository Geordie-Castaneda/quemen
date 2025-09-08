# -*- coding: utf-8 -*-
from odoo import api, fields, models, SUPERUSER_ID, _
from odoo.exceptions import UserError
import logging
import pytz

class ProductTemplateExtraFields(models.Model):
    _name = 'product.template'
    _inherit = 'product.template'

    producto_porciones = fields.Many2one('product.template', string="Producto porciones")
    porciones = fields.Integer('Porciones')
    dias_caducidad_rebanado = fields.Integer('Dias caducidad rebanado')
