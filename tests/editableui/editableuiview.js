/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* globals document */

import EditableUIView from '../../src/editableui/editableuiview';
import View from '../../src/view';
import Locale from '@ckeditor/ckeditor5-utils/src/locale';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';

describe( 'EditableUIView', () => {
	let view, editableElement, locale;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		locale = new Locale( 'en' );
		editableElement = document.createElement( 'div' );

		view = new EditableUIView( locale );
		view.render();
	} );

	describe( 'constructor()', () => {
		it( 'sets initial values of attributes', () => {
			expect( view.isReadOnly ).to.be.false;
			expect( view.isFocused ).to.be.false;
			expect( view._externalElement ).to.be.undefined;
		} );

		it( 'renders element from template when no editableElement', () => {
			view = new EditableUIView( locale );

			view.render();
			expect( view.element ).to.equal( view._editableElement );
			expect( view.element.classList.contains( 'ck' ) ).to.be.true;
			expect( view.element.classList.contains( 'ck-editor__editable' ) ).to.be.true;
			expect( view.element.classList.contains( 'ck-content' ) ).to.be.true;
			expect( view.element.classList.contains( 'ck-rounded-corners' ) ).to.be.true;
			expect( view._externalElement ).to.be.undefined;
			expect( view.isRendered ).to.be.true;
		} );

		it( 'accepts editableElement as an argument', () => {
			view = new EditableUIView( locale, editableElement );

			view.render();
			expect( view.element ).to.equal( editableElement );
			expect( view.element ).to.equal( view._editableElement );
			expect( view.element.classList.contains( 'ck' ) ).to.be.true;
			expect( view.element.classList.contains( 'ck-editor__editable' ) ).to.be.true;
			expect( view.element.classList.contains( 'ck-rounded-corners' ) ).to.be.true;
			expect( view._hasExternalElement ).to.be.true;
			expect( view.isRendered ).to.be.true;
		} );
	} );

	describe( 'View bindings', () => {
		describe( 'class', () => {
			it( 'reacts on view#isFocused', () => {
				view.isFocused = true;

				expect( view.element.classList.contains( 'ck-focused' ) ).to.be.true;
				expect( view.element.classList.contains( 'ck-blurred' ) ).to.be.false;

				view.isFocused = false;
				expect( view.element.classList.contains( 'ck-focused' ) ).to.be.false;
				expect( view.element.classList.contains( 'ck-blurred' ) ).to.be.true;
			} );
		} );

		describe( 'contenteditable', () => {
			it( 'reacts on view#isReadOnly', () => {
				view.isReadOnly = true;
				expect( view.element.hasAttribute( 'contenteditable' ) ).to.be.false;
				expect( view.element.classList.contains( 'ck-read-only' ) ).to.be.true;

				view.isReadOnly = false;
				expect( view.element.hasAttribute( 'contenteditable' ) ).to.be.true;
				expect( view.element.classList.contains( 'ck-read-only' ) ).to.be.false;
			} );
		} );
	} );

	describe( 'destroy()', () => {
		it( 'calls super#destroy()', () => {
			const spy = testUtils.sinon.spy( View.prototype, 'destroy' );

			view.destroy();
			sinon.assert.calledOnce( spy );
		} );

		it( 'can be called multiple times', () => {
			expect( () => {
				view.destroy();
				view.destroy();
			} ).to.not.throw();
		} );

		describe( 'when #editableElement as an argument', () => {
			it( 'reverts contentEditable property of editableElement (was false)', () => {
				editableElement = document.createElement( 'div' );
				editableElement.contentEditable = false;

				view = new EditableUIView( locale, editableElement );

				view.render();
				expect( editableElement.contentEditable ).to.equal( 'true' );
				view.destroy();
				expect( editableElement.contentEditable ).to.equal( 'false' );
			} );

			it( 'reverts contentEditable property of editableElement (was true)', () => {
				editableElement = document.createElement( 'div' );
				editableElement.contentEditable = true;

				view = new EditableUIView( locale, editableElement );

				view.render();
				expect( editableElement.contentEditable ).to.equal( 'true' );
				view.destroy();
				expect( editableElement.contentEditable ).to.equal( 'true' );
			} );
		} );
	} );
} );
