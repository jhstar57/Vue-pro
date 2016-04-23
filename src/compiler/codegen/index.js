import { genDirectives, genHandlers } from './directives/index'
import { isReservedTag } from '../../runtime/util/dom'

let staticRenderFns

export function generate (ast) {
  staticRenderFns = []
  const code = ast ? genElement(ast) : '__h__("div")'
  return {
    render: `with (this) { return ${code}}`,
    staticRenderFns
  }
}

function genElement (el) {
  if (el.for) {
    return genFor(el)
  } else if (el.if) {
    return genIf(el)
  } else if (el.tag === 'template' && !el.slotTarget) {
    return genChildren(el)
  } else if (el.tag === 'render') {
    return genRender(el)
  } else if (el.tag === 'slot') {
    return genSlot(el)
  } else if (el.tag === 'component') {
    return genComponent(el)
  } else {
    // if the element is potentially a component,
    // wrap its children as a thunk.
    const children = genChildren(el, !isReservedTag(el.tag) /* asThunk */)
    const code = `__h__('${el.tag}', ${genData(el)}, ${children}, '${el.ns || ''}')`
    if (el.staticRoot) {
      // hoist static sub-trees out
      staticRenderFns.push(`with(this){return ${code}}`)
      return `__static__(${staticRenderFns.length - 1})`
    } else {
      return code
    }
  }
}

function genIf (el) {
  const exp = el.if
  el.if = false // avoid recursion
  return `(${exp}) ? ${genElement(el)} : ${genElse(el)}`
}

function genElse (el) {
  return el.elseBlock
    ? genElement(el.elseBlock)
    : 'null'
}

function genFor (el) {
  const exp = el.for
  const alias = el.alias
  const iterator = el.iterator
  el.for = false // avoid recursion
  return `(${exp})&&__renderList__((${exp}), ` +
    `function(${alias},$index${iterator ? `,${iterator}` : ''}){` +
      `return ${genElement(el)}` +
    '})'
}

function genData (el) {
  if (el.plain) {
    return 'undefined'
  }

  let data = '{'

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  if (el.directives) {
    let dirs = genDirectives(el)
    if (dirs) data += dirs + ','
  }
  // pre
  if (el.pre) {
    data += 'pre:true,'
  }
  // key
  if (el.key) {
    data += `key:${el.key},`
  }
  // slot target
  if (el.slotTarget) {
    data += `slot:${el.slotTarget},`
  }
  // class
  if (el.staticClass) {
    data += `staticClass:${el.staticClass},`
  }
  if (el.classBinding) {
    data += `class:${el.classBinding},`
  }
  // style
  if (el.styleBinding) {
    data += `style:${el.styleBinding},`
  }
  // transition
  if (el.transition) {
    data += `transition:__resolveTransition__(${
      el.transition
    }, ${
      el.transitionOnAppear
    }),`
  }
  // v-show, used to avoid transition being applied
  // since v-show takes it over
  if (el.attrsMap['v-show'] || el.show) {
    data += 'show:true,'
  }
  // props
  if (el.props) {
    data += `props:{${genProps(el.props)}},`
  }
  // attributes
  if (el.attrs) {
    data += `attrs:{${genProps(el.attrs)}},`
  }
  // static attributes
  if (el.staticAttrs) {
    data += `staticAttrs:{${genProps(el.staticAttrs)}},`
  }
  // hooks
  if (el.hooks) {
    data += `hook:{${genHooks(el.hooks)}},`
  }
  // event handlers
  if (el.events) {
    data += genHandlers(el.events)
  }
  return data.replace(/,$/, '') + '}'
}

function genChildren (el, asThunk) {
  if (!el.children.length) {
    return 'undefined'
  }
  const code = '[' + el.children.map(genNode).join(',') + ']'
  return asThunk
    ? `function(){return ${code}}`
    : code
}

function genNode (node) {
  if (node.tag) {
    return genElement(node)
  } else {
    return genText(node)
  }
}

function genText (text) {
  return text.expression
    ? `(${text.expression})`
    : JSON.stringify(text.text)
}

function genRender (el) {
  return `${el.renderMethod}(${el.renderArgs || 'null'},${genChildren(el)})`
}

function genSlot (el) {
  const name = el.slotName || '"default"'
  return `($slots[${name}] || ${genChildren(el)})`
}

function genComponent (el) {
  return `__h__(${el.component}, ${genData(el)}, ${genChildren(el, true)})`
}

function genProps (props) {
  let res = ''
  for (let i = 0; i < props.length; i++) {
    let prop = props[i]
    res += `"${prop.name}":${prop.value},`
  }
  return res.slice(0, -1)
}

function genHooks (hooks) {
  let res = ''
  for (let key in hooks) {
    res += `"${key}":function(n1,n2){${hooks[key].join(';')}},`
  }
  return res.slice(0, -1)
}
