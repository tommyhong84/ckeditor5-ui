/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module ui/toolbar/balloon/balloontoolbar
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ContextualBalloon from '../../panel/balloon/contextualballoon';
import ToolbarView from '../toolbarview';
import BalloonPanelView from '../../panel/balloon/balloonpanelview.js';
import debounce from '@ckeditor/ckeditor5-utils/src/lib/lodash/debounce';
import Rect from '@ckeditor/ckeditor5-utils/src/dom/rect';
import normalizeToolbarConfig from '../normalizetoolbarconfig';

/**
 * The contextual toolbar.
 *
 * It uses the {@link module:ui/panel/balloon/contextualballoon~ContextualBalloon contextual balloon plugin}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class BalloonToolbar extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'BalloonToolbar';
	}

	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ ContextualBalloon ];
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;

		/**
		 * The toolbar view displayed in the balloon.
		 *
		 * @type {module:ui/toolbar/toolbarview~ToolbarView}
		 */
		this.toolbarView = this._createToolbarView();

		/**
		 * The contextual balloon plugin instance.
		 *
		 * @private
		 * @type {module:ui/panel/balloon/contextualballoon~ContextualBalloon}
		 */
		this._balloon = editor.plugins.get( ContextualBalloon );

		/**
		 * Fires {@link #event:_selectionChangeDebounced} event using `lodash#debounce`.
		 *
		 * This function is stored as a plugin property to make possible to cancel
		 * trailing debounced invocation on destroy.
		 *
		 * @private
		 * @type {Function}
		 */
		this._fireSelectionChangeDebounced = debounce( () => this.fire( '_selectionChangeDebounced' ), 200 );

		// Attach lifecycle actions.
		this._handleSelectionChange();
		this._handleFocusChange();

		// The appearance of the BalloonToolbar method is event–driven.
		// It is possible to stop the #show event and this prevent the toolbar from showing up.
		this.decorate( 'show' );
	}

	/**
	 * Creates toolbar components based on given configuration.
	 * This needs to be done when all plugins are ready.
	 *
	 * @inheritDoc
	 */
	afterInit() {
		const config = normalizeToolbarConfig( this.editor.config.get( 'balloonToolbar' ) );
		const factory = this.editor.ui.componentFactory;

		this.toolbarView.fillFromConfig( config.items, factory );
	}

	/**
	 * Creates the toolbar view instance.
	 *
	 * @private
	 * @returns {module:ui/toolbar/toolbarview~ToolbarView}
	 */
	_createToolbarView() {
		const toolbarView = new ToolbarView( this.editor.locale );

		toolbarView.extendTemplate( {
			attributes: {
				class: [ 'ck-toolbar_floating' ]
			}
		} );

		toolbarView.render();

		return toolbarView;
	}

	/**
	 * Handles the editor focus change and hides the toolbar if it's needed.
	 *
	 * @private
	 */
	_handleFocusChange() {
		const editor = this.editor;

		this.listenTo( editor.editing.view.document, 'change:isFocused', ( evt, name, isFocused ) => {
			if ( !isFocused && this._balloon.visibleView === this.toolbarView ) {
				this.hide();
			} else if ( isFocused ) {
				this.show();
			}
		} );
	}

	/**
	 * Handles {@link module:engine/model/document~Document#selection} change and show or hide toolbar.
	 *
	 * @private
	 */
	_handleSelectionChange() {
		const selection = this.editor.model.document.selection;

		// Hide the toolbar when the selection is changed by a direct change or has changed to collapsed.
		this.listenTo( selection, 'change:range', ( evt, data ) => {
			if ( data.directChange || selection.isCollapsed ) {
				this.hide();
			}

			// Fire internal `_selectionChangeDebounced` when the selection stops changing.
			this._fireSelectionChangeDebounced();
		} );

		// Hide the toolbar when the selection stops changing.
		this.listenTo( this, '_selectionChangeDebounced', () => {
			if ( this.editor.editing.view.document.isFocused ) {
				this.show();
			}
		} );
	}

	/**
	 * Shows the toolbar and attaches it to the selection.
	 *
	 * Fires {@link #event:show} event which can be stopped to prevent the toolbar from showing up.
	 */
	show() {
		const editor = this.editor;

		// Do not add the toolbar to the balloon stack twice.
		if ( this._balloon.hasView( this.toolbarView ) ) {
			return;
		}

		// Do not show the toolbar when the selection is collapsed.
		if ( editor.model.document.selection.isCollapsed ) {
			return;
		}

		// Don not show the toolbar when all components inside are disabled
		// see https://github.com/ckeditor/ckeditor5-ui/issues/269.
		if ( Array.from( this.toolbarView.items ).every( item => item.isEnabled !== undefined && !item.isEnabled ) ) {
			return;
		}

		// Update the toolbar position upon change (e.g. external document changes)
		// while it's visible.
		this.listenTo( this.editor.editing.view, 'render', () => {
			this._balloon.updatePosition( this._getBalloonPositionData() );
		} );

		// Add the toolbar to the common editor contextual balloon.
		this._balloon.add( {
			view: this.toolbarView,
			position: this._getBalloonPositionData(),
			balloonClassName: 'ck-toolbar-container'
		} );
	}

	/**
	 * Hides the toolbar.
	 */
	hide() {
		if ( this._balloon.hasView( this.toolbarView ) ) {
			this.stopListening( this.editor.editing.view, 'render' );
			this._balloon.remove( this.toolbarView );
		}
	}

	/**
	 * Returns positioning options for the {@link #_balloon}. They control the way balloon is attached
	 * to the selection.
	 *
	 * @private
	 * @returns {module:utils/dom/position~Options}
	 */
	_getBalloonPositionData() {
		const editor = this.editor;
		const view = editor.editing.view;
		const viewDocument = view.document;
		const viewSelection = viewDocument.selection;

		// Get direction of the selection.
		const isBackward = viewDocument.selection.isBackward;

		return {
			// Because the target for BalloonPanelView is a Rect (not DOMRange), it's geometry will stay fixed
			// as the window scrolls. To let the BalloonPanelView follow such Rect, is must be continuously
			// computed and hence, the target is defined as a function instead of a static value.
			// https://github.com/ckeditor/ckeditor5-ui/issues/195
			target: () => {
				const range = isBackward ? viewSelection.getFirstRange() : viewSelection.getLastRange();
				const rangeRects = Rect.getDomRangeRects( view.domConverter.viewRangeToDom( range ) );

				// Select the proper range rect depending on the direction of the selection.
				if ( isBackward ) {
					return rangeRects[ 0 ];
				} else {
					// Ditch the zero-width "orphan" rect in the next line for the forward selection if there's
					// another one preceding it. It is not rendered as a selection by the web browser anyway.
					// https://github.com/ckeditor/ckeditor5-ui/issues/308
					if ( rangeRects.length > 1 && rangeRects[ rangeRects.length - 1 ].width === 0 ) {
						rangeRects.pop();
					}

					return rangeRects[ rangeRects.length - 1 ];
				}
			},
			positions: getBalloonPositions( isBackward )
		};
	}

	/**
	 * @inheritDoc
	 */
	destroy() {
		this._fireSelectionChangeDebounced.cancel();
		this.stopListening();
		super.destroy();
	}

	/**
	 * This event is fired just before the toolbar shows up. Stopping this event will prevent this.
	 *
	 * @event show
	 */

	/**
	 * This is internal plugin event which is fired 200 ms after model selection last change.
	 * This is to makes easy test debounced action without need to use `setTimeout`.
	 *
	 * @protected
	 * @event _selectionChangeDebounced
	 */
}

// Returns toolbar positions for the given direction of the selection.
//
// @private
// @param {Boolean} isBackward
// @returns {Array.<module:utils/dom/position~Position>}
function getBalloonPositions( isBackward ) {
	const defaultPositions = BalloonPanelView.defaultPositions;

	return isBackward ? [
		defaultPositions.northWestArrowSouth,
		defaultPositions.northWestArrowSouthWest,
		defaultPositions.northWestArrowSouthEast,
		defaultPositions.southWestArrowNorth,
		defaultPositions.southWestArrowNorthWest,
		defaultPositions.southWestArrowNorthEast
	] : [
		defaultPositions.southEastArrowNorth,
		defaultPositions.southEastArrowNorthEast,
		defaultPositions.southEastArrowNorthWest,
		defaultPositions.northEastArrowSouth,
		defaultPositions.northEastArrowSouthEast,
		defaultPositions.northEastArrowSouthWest
	];
}

/**
 * Contextual toolbar configuration. Used by the {@link module:ui/toolbar/balloon/balloontoolbar~BalloonToolbar}
 * feature.
 *
 *		const config = {
 *			balloonToolbar: [ 'bold', 'italic', 'undo', 'redo' ]
 *		};
 *
 * You can also use `'|'` to create a separator between groups of items:
 *
 *		const config = {
 *			balloonToolbar: [ 'bold', 'italic', | 'undo', 'redo' ]
 *		};
 *
 * Read also about configuring the main editor toolbar in {@link module:core/editor/editorconfig~EditorConfig#toolbar}.
 *
 * @member {Array.<String>|Object} module:core/editor/editorconfig~EditorConfig#balloonToolbar
 */
