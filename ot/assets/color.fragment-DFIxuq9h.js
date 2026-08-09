import{p as e}from"./math.scalar.functions-CQA38JRp.js";import{t}from"./shaderStore-D-XQlhUT.js";import{t as n}from"./clipPlaneFragmentDeclaration-DXLRKKba.js";import{t as r}from"./clipPlaneFragment-fDMn0WjW.js";import{t as i}from"./fogFragmentDeclaration-3nLtKC4p.js";import{t as a}from"./fogFragment-C9E3EVJj.js";var o=e({colorPixelShaderWGSL:()=>u}),s=`colorPixelShader`,c=`#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
#define VERTEXCOLOR
varying vColor: vec4f;
#else
uniform color: vec4f;
#endif
#include<clipPlaneFragmentDeclaration>
#include<fogFragmentDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
fragmentOutputs.color=input.vColor;
#else
fragmentOutputs.color=uniforms.color;
#endif
#include<fogFragment>(color,fragmentOutputs.color)
#define CUSTOM_FRAGMENT_MAIN_END
}`;t.ShadersStoreWGSL[s]||(t.ShadersStoreWGSL[s]=c);var l=[n,i,r,a];for(let e of l)t.IncludesShadersStoreWGSL[e.name]||(t.IncludesShadersStoreWGSL[e.name]=e.shader);var u={name:s,shader:c};export{o as t};