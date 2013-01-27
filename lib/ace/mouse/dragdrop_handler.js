/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var dom = require("../lib/dom");
var useragent = require("../lib/useragent");

// Safari crashes while creating image on dragstart
var blankImage = new Image();
blankImage.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function DragdropHandler(mouseHandler) {

    var editor = mouseHandler.editor;
    if (useragent.isOpera) {
        blankImage.style.cssText = 'width:1px;height:1px;position:fixed;top:0;z-index:-1';
        editor.container.appendChild(blankImage);
    }

    editor.setDefaultHandler("dragstart", this.onDragStart.bind(mouseHandler));
    editor.setDefaultHandler("dragend", this.onDragEnd.bind(mouseHandler));
    editor.setDefaultHandler("dragenter", this.onDragEnter.bind(mouseHandler));
    editor.setDefaultHandler("dragover", this.onDragOver.bind(mouseHandler));
    editor.setDefaultHandler("dragleave", this.onDragLeave.bind(mouseHandler));
    editor.setDefaultHandler("drop", this.onDrop.bind(mouseHandler));
}

(function() {

    this.dragRange = null;
    this.isBackwards = false;
    this.selectionMarker = null;
    this.dragCursor = null;

    // WebKit provides wrong dataTransfer.dropEffect on drop/dragend. Also used as internal operation flag
    this.dragOperation = null;

    this.onDragStart = function(e) {
        this.isDragWait = false;

        var editor = this.editor;
        var dataTransfer = e.domEvent.dataTransfer;

        this.dragRange = editor.getSelectionRange();

        dataTransfer.effectAllowed = "copyMove";
        dataTransfer.setDragImage && dataTransfer.setDragImage(blankImage, 0, 0);
        dataTransfer.setData("Text", editor.session.getTextRange());

        editor.renderer.$cursorLayer.setBlinking(false);
        dom.addCssClass(editor.container, "ace_dragging");
        this.setState("drag");
    };

    this.onDragEnd = function(e) {
        var editor = this.editor;
        var target = editor.renderer.getMouseEventTarget();
        var dataTransfer = e.domEvent.dataTransfer;
        var dropEffect = dataTransfer.dropEffect;

        if (target.draggable !== undefined)
                    target.draggable = false;

        if (!this.dragOperation && dropEffect == "move")
            editor.session.remove(editor.getSelectionRange());
        else
            this.dragOperation = null;

        editor.renderer.$cursorLayer.setBlinking(true);
        this.setState("null");
    }

    this.onDragEnter = function(e) {
        var editor = this.editor;
        var dataTransfer = e.domEvent.dataTransfer;

        dataTransfer.dropEffect = this.dragOperation = getDropEffect(e.domEvent);

        dom.addCssClass(editor.container, "ace_dragging");
        return e.preventDefault();
    };

    this.onDragOver = function(e) {
        var editor = this.editor;
        var dataTransfer = e.domEvent.dataTransfer;

        if (!this.selectionMarker) {
            this.dragRange = editor.getSelectionRange();
            this.isBackwards = editor.selection.isBackwards();
            editor.clearSelection();
            var style = editor.getSelectionStyle();
            this.selectionMarker = editor.session.addMarker(this.dragRange, "ace_selection", style);
        }

        this.x = e.clientX;
        this.y = e.clientY;

        this.dragCursor = editor.renderer.screenToTextCoordinates(this.x, this.y);
        editor.moveCursorToPosition(this.dragCursor);

        dataTransfer.dropEffect = this.dragOperation = getDropEffect(e.domEvent);

        return e.preventDefault();
    };

    this.onDragLeave = function(e) {
        var editor = this.editor;
        var target = editor.renderer.getMouseEventTarget();

        console.log( (e.domEvent.srcElement || e.domEvent.target).className );

        if (target !== (e.domEvent.target || e.domEvent.srcElement))
            return;

        dom.removeCssClass(editor.container, "ace_dragging");
        if (this.selectionMarker) {
            editor.session.removeMarker(this.selectionMarker);
            editor.selection.setSelectionRange(this.dragRange, this.isBackwards);
        }
        this.dragOperation = null;
        this.selectionMarker = this.dragRange = this.isBackwards = this.dragCursor = null;
    };

    this.onDrop = function(e) {
        var editor = this.editor;
        var dataTransfer = e.domEvent.dataTransfer;

        if (this.state !== "drag") {
            // external drop
            this.dragOperation = null;
        }

        if (this.dragOperation == "move"){
            // internal moving
            if (this.dragRange.contains(this.dragCursor.row, this.dragCursor.column)) {
                var newRange = {
                    start: this.dragCursor,
                    end: this.dragCursor
                };
            } else {
                var newRange = editor.moveText(this.dragRange, this.dragCursor);
            }
        } else {
            // external drop or internal copying
            var dropData = dataTransfer.getData('Text');
            var newRange = {
                start: this.dragCursor,
                end: editor.session.insert(this.dragCursor, dropData)
            };
            editor.focus();
        }
        editor.selection.setSelectionRange(newRange);
        editor.session.removeMarker(this.selectionMarker);
        dom.removeCssClass(editor.container, "ace_dragging");
        this.selectionMarker = this.isBackwards = this.dragRange = this.dragCursor = null;
    };

}).call(DragdropHandler.prototype);

exports.DragdropHandler = DragdropHandler;



function getDropEffect(e) {
    var copyAllowed = ['copy', 'copymove', 'all', 'uninitialized'];
    var moveAllowed = ['move', 'copymove', 'linkmove', 'all', 'uninitialized'];

    var copyModifierState = useragent.isMac ? e.altKey : e.ctrlKey;

    // IE throws error while dragging from another app
    try{
        var effectAllowed = e.dataTransfer.effectAllowed.toLowerCase();
    } catch (e) {
        var effectAllowed = "uninitialized";
    }
    var dropEffect = "none";

    if (copyModifierState && copyAllowed.indexOf(effectAllowed) >= 0)
        dropEffect = "copy";
    else if (moveAllowed.indexOf(effectAllowed) >= 0)
        dropEffect = "move"
    else if (copyAllowed.indexOf(effectAllowed) >= 0)
        dropEffect = "copy";

    return dropEffect;
}

});
