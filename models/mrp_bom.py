# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.osv.expression import AND, NEGATIVE_TERM_OPERATORS, OR
from odoo.tools import float_round

from collections import defaultdict


class MrpBom(models.Model):
    _inherit = 'mrp.bom'

    area = fields.Char('Area')

class MrpBomLine(models.Model):
    """ Defines bills of material for a product or a product template """
    _inherit = 'mrp.bom.line'
    _order = "stage asc"

    stage = fields.Integer('Etapa')
    location_src_id = fields.Many2one('stock.location','Ubicación origen')
