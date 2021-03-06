import React, { PropTypes, Component } from 'react';
import DropZone from 'react-dropzone';
import { IconButton } from 'react-mdl';

export default class Images extends Component {
	constructor(props) {
		super(props);
		this.state = {
			files: []
		};
	}

	onDrop = (files) => {
		this.props.addImages(files);
	};

	imageChecked = (index, evt) => {
		const { history, location } = this.props;
		const insertAt = location.query.iat;
		const headerRef = location.query.ref;

		if(!(insertAt || headerRef))return;

		if(insertAt) {
			history.push('/dashboard/post');
			return this.props.insertImage(index, insertAt);
		}
		
		history.push('/dashboard/post/settings');
		return this.props.addHeaderImage(index);
	};

	render() {
		const { files } = this.props;
		return (
			<div className="PostImages">
				<DropZone onDrop={this.onDrop} className="DropZone">
	              <div>Try dropping some files here, or click to select files to upload...</div>
	            </DropZone>

	            <div className="grid">
	            	{
					files.length > 0 ? <div>
						<h3>Attached Images</h3>
		                <div className="attached">
		                {
		                	files.map((file, index) => {
		                		return (
		                			<div className={`attached-item-${index}`} key={index}>
		                				<IconButton name="insert_photo" onClick={this.imageChecked.bind(this, index)} className="Image_check"/>
		                				<img src={file.preview} />
		                			</div>
		                		);
		                	})
		            	}</div>
		                </div> : null
	            	}
	            </div>
				
			</div>
		);
	}
}