 import React, { Component, PropTypes } from 'react';
 import Helmet from "react-helmet";

if(process.env.BROWSER) {
  //in production change to cdn files
  require('material-design-icons/iconfont/material-icons.css');
  require('styles/mdl-styles/material-design-lite.scss');
  //require('react-mdl/extra/material.css');
  require('react-mdl/extra/material.min.js');
  //material-design selectbox
  require('getmdl-select/getmdl-select.min');
  require('getmdl-select/getmdl-select.min.css');
  //toastr

  //application styles
	require('styles/main.scss');
}

export default class AppView extends Component {
  render() {
  	//this is where basic structure shud live
    return (
      <div id="app-view">
        <Helmet title="GNAAS" />
        {this.props.children}
      </div>
    );
  }
}