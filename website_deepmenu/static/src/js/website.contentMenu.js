odoo.define('website_deepmenu.contentMenu', function (require) {
"use strict";

var core = require('web.core');
var ajax = require('web.ajax');
var Widget = require('web.Widget');
var base = require('web_editor.base');
var editor = require('web_editor.editor');
var widget = require('web_editor.widget');
var website = require('website.website');
var contentMenu = require('website.contentMenu');

var _t = core._t;
var qweb = core.qweb;

ajax.loadXML('/website_deepmenu/static/src/xml/website.contentMenu.xml', qweb);

contentMenu.TopBar.include({
    edit_deep_menu: function() {
        var self = this;
        var context = base.get_context();
        var def = $.Deferred();
        if ($("[data-content_menu_id]").length) {
            var select = new SelectEditMenuDialog();
            select.appendTo(document.body);
            select.on('save', this, function (root) {
                def.resolve(root);
            });
        } else {
            def.resolve(null);
        }

        def.then(function (root_id) {
            ajax.jsonRpc('/web/dataset/call_kw', 'call', {
                model: 'website.menu',
                method: 'get_tree',
                args: [context.website_id, root_id],
                kwargs: {
                    context: context
                },
            }).then(function (menu) {
                var result = new EditMenuDialog(menu).appendTo(document.body);
                return result;
            });
        });
    },
});

var EditMenuDialog = widget.Dialog.extend({
    template: 'website.contentMenu.dialog.edit',
    events: _.extend({}, widget.Dialog.prototype.events, {
        'click a.js_add_menu': 'add_menu',
        'click button.js_edit_menu': 'edit_menu',
        'click button.js_delete_menu': 'delete_menu',
    }),
    init: function (menu) {
        this.menu = menu;
        this.root_menu_id = menu.id;
        this.flat = this.flatenize(menu);
        this.to_delete = [];
        this._super();
    },
    start: function () {
        var r = this._super.apply(this, arguments);
        this.$('.oe_menu_editor').nestedSortable({
            listType: 'ul',
            handle: 'div',
            items: 'li',
            maxLevels: 99,
            toleranceElement: '> div',
            forcePlaceholderSize: true,
            opacity: 0.6,
            placeholder: 'oe_menu_placeholder',
            tolerance: 'pointer',
            attribute: 'data-menu-id',
            expression: '()(.+)', // nestedSortable takes the second match of an expression (*sigh*)
        });
        return r;
    },
    flatenize: function (node, dict) {
        dict = dict || {};
        var self = this;
        dict[node.id] = node;
        node.children.forEach(function (child) {
            self.flatenize(child, dict);
        });
        return dict;
    },
    add_menu: function () {
        var self = this;
        var dialog = new MenuEntryDialog(undefined, {});
        dialog.on('save', this, function (link) {
            var new_menu = {
                id: _.uniqueId('new-'),
                name: link.text,
                url: link.url,
                new_window: link.isNewWindow,
                parent_id: false,
                sequence: 0,
                children: [],
            };
            self.flat[new_menu.id] = new_menu;
            self.$('.oe_menu_editor').append(
                qweb.render('website.contentMenu.dialog.submenu', { submenu: new_menu }));
        });
        dialog.appendTo(document.body);
    },
    edit_menu: function (ev) {
        var self = this;
        var menu_id = $(ev.currentTarget).closest('[data-menu-id]').data('menu-id');
        var menu = self.flat[menu_id];
        if (menu) {
            var dialog = new MenuEntryDialog(undefined, menu);
            dialog.on('save', this, function (link) {
                var id = link.id;
                var menu_obj = self.flat[id];
                _.extend(menu_obj, {
                    'name': link.text,
                    'url': link.url,
                    'new_window': link.isNewWindow,
                });
                var $menu = self.$('[data-menu-id="' + id + '"]');
                $menu.find('.js_menu_label').first().text(menu_obj.name);
            });
            dialog.appendTo(document.body);
        } else {
            alert("Could not find menu entry");
        }
    },
    delete_menu: function (ev) {
        var self = this;
        var $menu = $(ev.currentTarget).closest('[data-menu-id]');
        var mid = $menu.data('menu-id')|0;
        if (mid) {
            this.to_delete.push(mid);
        }
        $menu.remove();
    },
    save: function () {
        var self = this;
        var new_menu = this.$('.oe_menu_editor').nestedSortable('toArray', {startDepthCount: 0});
        var levels = [];
        var data = [];
        var context = base.get_context();
        // Resequence, re-tree and remove useless data
        new_menu.forEach(function (menu) {
            if (menu.item_id) {
                levels[menu.depth] = (levels[menu.depth] || 0) + 1;
                var mobj = self.flat[menu.item_id];
                mobj.sequence = levels[menu.depth];
                mobj.parent_id = (menu.parent_id|0) || menu.parent_id || self.root_menu_id;
                delete(mobj.children);
                data.push(mobj);
            }
        });
        ajax.jsonRpc('/web/dataset/call_kw', 'call', {
            model: 'website.menu',
            method: 'save',
            args: [[context.website_id], { data: data, to_delete: self.to_delete }],
            kwargs: {
                context: context
            },
        }).then(function (menu) {
            self.close();
            editor.reload();
        });
    },
});

});
