import { addProp } from 'compiler/helpers'
import { ASTDirective, ASTElement } from 'typescript/compiler'

export default function html(el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'innerHTML', `_s(${dir.value})`, dir)
  }
}
