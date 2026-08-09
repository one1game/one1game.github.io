import{p as e}from"./math.scalar.functions-CQA38JRp.js";import{t}from"./shaderStore-D-XQlhUT.js";import{t as n}from"./clipPlaneFragmentDeclaration-DXLRKKba.js";import{t as r}from"./clipPlaneFragment-fDMn0WjW.js";import{t as i}from"./logDepthDeclaration-B__dAhYE.js";import{t as a}from"./logDepthFragment-CxtJswLx.js";var o=e({linePixelShaderWGSL:()=>u}),s=`linePixelShader`,c=`#include<clipPlaneFragmentDeclaration>
uniform color: vec4f;
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<logDepthFragment>
#include<clipPlaneFragment>
fragmentOutputs.color=uniforms.color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;t.ShadersStoreWGSL[s]||(t.ShadersStoreWGSL[s]=c);var l=[n,i,a,r];for(let e of l)t.IncludesShadersStoreWGSL[e.name]||(t.IncludesShadersStoreWGSL[e.name]=e.shader);var u={name:s,shader:c};export{o as t};