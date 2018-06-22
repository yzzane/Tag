/**
 * 配合bootstrap使用
 * 利用jQuery进行插件扩展。
 * 整体架构:1.利用$.fn.tag = function() {}，供jQuery实例使用
 *          2.利用即执行函数创建私有作用域（命名空间）
 */

!function($){
	"use strict";

	/**
	 * Contructor
	 * @param {HTMLElement} element 
	 * @param {object | string} options 
	 */
	var Typeahead = function(element, options) {
		this.$element = $(element);
		this.options = $.extend({}, $.fn.bs_typeahead.defaults, options);
		this.init(this.options);
	};

	/**
	 * 构造函数原型
	 */
	Typeahead.prototype = {
		constructor: Typeahead,
		//数据初始化
		init: function(options) {
			this.$menu = $(options.menu);		
			this.matcher = options.matcher || this.matcher;
			this.sorter = options.sorter || this.sorter;
			this.highlighter = options.highlighter || this.highlighter;
			this.update = options.update || this.update;
			this.select = options.select || this.select;
			this.source = options.source || this.source;
			this.shown = false;
			this.listen();
		},

		select: function() {
			var item, activeItem = this.$menu.find("active").data("value");
			item = JSON.parse(activeItem);
			this.$element.val(this.update(item)).change();
			return this.hide()
		},

		//只起占位作用，在使用过程中会重写此函数
		update: function(item) {
			return item;
		},

		hide: function() {
			this.$menu.hide();
			this.shown = false;
			return this;
		},

		show: function() { //显示选项
			//this.$element.position() 返回一个对象:{ top: , left: }
			var pos = $.extend({}, this.$element.position(), { height: this.$element[0].offsetHeight });
			this.$menu.insertAfter(this.$element)
								.css({
									top: pos.top + pos.height,
									left: pos.left
								})
								.show();
			this.shown = true;
			return this;
		},

		lookup: function(event) { //处理数据
			this.query = $.trim(this.$element.val())

			if(!this.query || this.query.length < this.options.minLength) {
				return this.shown ? this.hide() : this
			}

			var items = $.isFunction(this.source) ? this.source(this.query, $.proxy(this.process, this), this.$element) : this.source;
			return items ? this.process(items) : this;
		},

		process: function(items) {
			var that = this;
			items = $.grep(items, function(item) {
				return that.matcher(item);
			})

			items = this.sorter(items)
			if(!items.length) return this.shown ? this.hide() : this;

			return this.render(items.slice(0, this.options.items)).show()
		},

		matcher: function(item) {
			return ~item.toLowerCase().indexOf(this.query.toLowerCase())
		},

		// 可以重写
		sorter: function(items) { //处理item 和 query
			var begainsWith = [],
			caseSensitive = [],
			caseInsensitive = [],
			item;
			while(item = items.shift()) {
				if(!item.toLowerCase().indexOf(this.query.toLowerCase())) //只有为0的时候才会推进数组
					begainsWith.push(item)
				else if(~item.indexOf(this.query))
					caseSensitive.push(item)
				else
					caseInsensitive.push(item)
			}

			return begainsWith.concat(caseSensitive, caseInsensitive)
		},

		highlighter: function(item) {
			var query = this.query.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')
      return item.replace(new RegExp('(' + query + ')', 'ig'), function($l, match) {
        return '<strong>' + match + '</strong>'
      })
		},
		
		//核心方法:渲染数据项
		render: function(items) {
			var that = this, value = "";
			items = $.map(items, function(i, item) {
				value = item.toString();
				if($.isPlainObject(item)) {
					value = JSON.stringify(item)
				};
				
				i = $(this.options.item).attr("data-value", value);
				i.find("a").html(that.highlighter(item));													
				return i[0];
			});

			items.first().addClass("active");
			this.$menu.html(items);
			return this;
		},

		next: function(e) {
			var active = this.$menu.find(".active").removeClass("active"),
					next = active.next();
			if(!next.length) next = $(this.$menu.find("li")[0]);

			next.addClass("active")
		},

		prev: function(e) {
			var active = this.$menu.find(".active").removeClass("active"),
					prev = active.prev();
			if(!prev.length) prev = $(this.$menu.find("li").last());

			prev.addClass("active");
		},

		move: function(e) {
			if(!this.shown) return;

			switch(e.keycode) {
				case 9:  //tab
				case 13: //enter
				case 27: //esc
					e.preventDefault();
					break;
				case 40: //down arrow
					e.preventDefault();
					this.next();
					break;
			}
			e.stopPropagation();
		},

		//任意键都会触发
		keydown: function(e) {
			this.suppressKeyPressRepeat = ~$.inArray(e.keycode, [9, 13, 27, 38, 40]);
			this.move(e);
		},

		//keypress事件只有在用户按下字符键才能触发，即只有按下能产生字符的键才能触发
		keypress: function(e) {
			if(this.suppressKeyPressRepeat) return;
			this.move(e);
		},

		keyup: function(e) {
			switch(e.keycode) {
        case 40: //down arrow
        case 38: //up arrow
        case 16: // shift
        case 17: //ctrl
        case 18: //alt
          break
        case 9: //tab
        case 13: //enter
          if(!this.shown) return
          this.select()
          break
        case 27: //esc
          if(!this.shown) return
          this.hide()
          break
        default:
          this.lookup()

      }

      e.stopPropagation()
      e.preventDefault()
		},

		focus: function(e) {
			this.focused = true;
		},

		blur: function(e) {
			this.focused = false;
			if(!this.mousedover && this.shown) this.hide();
		},

		click: function(e) {
			e.stopPropagation()
      e.preventDefault()
      this.select()
      this.$element.focus()
		},

		mouseenter: function(e) {
			this.mousedover = true;
			this.$menu.find(".active").removeClass("active");
			$(e.currentTarget).addClass("active");
		},

		mouseleave: function(e) {
			this.mousedover = false;
			if(!this.focused && this.shown) this.hide();
		},

		eventSupported: function(eventName) {
			//用in操作符判断目标元素上是否存在对应事件
			var isSupported = eventName in this.$element;
			if(!isSupported) {
				this.$element.attr(eventName, "return;");
				isSupported = typeof this.$element[eventName] === "function";
			}
			return isSupported;
		},

		listen: function() {
			//input name=tag-input
			this.$element.on("focus", $.proxy(this.focus, this))
									 .on("blur", $.proxy(this.blur, this))
									 .on("keypress", $.proxy(this.keypress, this))
									 .on("keyup", $.proxy(this.keyup, this));

			// ul
			this.$menu.on("click", $.proxy(this.click, this))
								.on("mouseenter", $.proxy(this.mouseenter, this))
								.on("mouseleave", $.proxy(this.mouseleave, this));

			if(this.eventSupported("keydown")) {
				this.$element.on("keydown", $.proxy(this.keydown, this));
			}
		}

	};

	$.fn.bs_typeahead = function(option) {
		return this.each(function() {
			var $this = $(this),
					data = $this.data("bs_typeahead"),
					options = typeof option === "object" && option;
			
			if(!data) { //如果data为null或undefined,则重新赋值
				$this.data("bs_typeahead", (data = new Typeahead(this, options)));
			}
			if(typeof option === "string" && typeof data[option] === "function") {
				data[option]();
			}				
		})
	};
	$.fn.bs_typeahead.defaults = {
		source: [],
		menu: '<ul class="typeahead dropdown-menu"></ul>',
		item: '<li><a href="#"></a></li>',
		minLength: 1
	};

}(window.jQuery)


!function($){
	"use strict";

	var Tag = function(element, options) {
		this.$element = $(element);
		this.options = $.extend({}, $.fn.tag.defaults, options);
		this.idMap = this.options.id || "id";
		this.valuesID = [];
		this.values = [];
		this.case = [];
		this.$element.val("");
		this.show();
	};

	Tag.prototype = {
		constructor: Tag,

		skip: true,

		itemText: function(item) {
			if(this.options.text) {
        var src = template.compile(this.options.text);
        return src(item);
      }
      return item.toString();
		},

		//创建span标签
		createBadge: function(item) {
			var that = this, text = this.itemText(item);
      $('<span />', {"class": "tag"}).html(text)
                                     .append($('<button type="button" class="close">&times;</button>')
                                              .on("click", function() {
																								that.remove(that.$element.siblings(".tag").index($(this).closest(".tag")))
																							})
                                    ).insertBefore(this.$element);

		},

		process: function() {
			var that = this;
			if(this.options.type == "select") {
				this.input.val("")
			}else{
				var values = $.grep($.map(this.input.val().split(","), $.trim))
				$.each(values, () => {
					this.add(this)
				})
				this.input.val("")
			}
		},
		
		//显示选项，核心功能
		show: function() {
			var that = this;
			this.$element.parent().prepend(this.$element.detach().hide());
			this.$element.wrap($('<div class="tags">')).parent()
									 .on("click", function() {
										 that.input.focus();
									 });
									 
			if(this.values.length) {
				$.each(this.values, (index, value) => {
					this.createBadge(value)
				})
			}

			this.input = $('<input type="text">')
										.attr("placeholder", this.options.placeholder)
										.insertBefore(this.$element)
										.on("focus", (e) => {
											this.$element.parent().addClass("tags-hover");
										})
										.on("blur", (e) => {
											if(!this.skip) {
												this.process();
												this.$element.parent().removeClass("tags-hover")
												this.$element.siblings(".tag").removeClass("tag-important")
											}
											this.skip = false;
										})
										.on("keydown", (e) => {
											//tab: 9, enter: 13, 
											if(e.keycode == 13 || e.keycode == 9) {
												if($.trim($(this).val()) && (!this.$element.siblings(".typeahead").length || this.$element.siblings(".typeahead").is(":hidden"))) {
														if(e.keycode !== 9) e.preventDefault();
														this.process();
												}
											}else if(e.keycode == 8) { //Backspage
												var count = this.$element.siblings(".tag").length;
												if(count) {
													var tag = this.$element.siblings('.tag:eq(' + (count - 1) + ')');
													if(tag.hasClass("tag-important")) this.remove(count - 1);
													else tag.addClass("tag-important")
												}
											}else{
												this.$element.siblings(".tag").removeClass("tag-important");
											}
										})
										.bs_typeahead({
											source: this.options.source,
											matcher: function(item) {
												return item;
											},
											sorter: function(items) { 
												var item, begainsWith = [], caseSensitive = [], caseInsensitive = [];
												while(item = items.shift()) {
													if(!item) begainsWith.push(item);
													else if(~item) caseSensitive.push(item);
													else caseInsensitive.push(item);
												}
												return begainsWith.concat(caseInsensitive, caseSensitive);
											},
											highlighter: function(item) {
												var query = this.query.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&'), text = that.itemText(item);
												return text.replace(new RegExp('(' + query + ')', 'ig'), function ($1, match) {
														return '<strong>' + match + '</strong>'
												})
											},
											update: $.proxy(that.add, that)
										});
			
			$(this.input.data('bs_typeahead').$menu).on('mousedown', function(e) {
				that.skip = true;
			});
			this.$element.trigger("shown");

		},

		inValues: function(item) {
			if(this.options.caseInsensitive) {
				var index = -1;
				$.each(this.values, (indexArr, value) => {
					if(this.itemText(value).toLowerCase() == this.itemText(item).toLowerCase()) {
						index = indexArr;
						return false;
					}
				})
				return index;
			}else{
				return $.inArray(item, this.values);
			}
		},
		inCase: function(item) {
			var that = this, index = -1;
			$.each(this.case, (indexArr, value) => {
				if(this.itemText(value).toLowerCase() == this.itemText(item).toLowerCase()) {
					index = indexArr;
					return false;
				}
			})
			return index;
		},

		add: function(item) {
			var that = this;
			if(!this.options.allowDuplicates) {
				var index = this.inValues(item);
				if(index !== -1) {
					var badge = this.$element.siblings(".tag:eq(" + index + ")")
					badge.addClass("tag-warning")
					setTimeout(() => {
						badge.removeClass("tag-warning");
					}, 500)
					return;
				}
			}

			if(this.options.max !== undefined) {
				if(this.values.length < this.options.max) {
					if(this.inCase(item) !== -1) {
						this.values.push(item);
						this.createBadge(item);
						this.valuesID.push(item[this.idMap]);
						this.$element.get(0).value = this.valuesID;
						this.$element.trigger("added", [item])
						if(this.values.length == this.options.max) {
							this.input.hide();
						}
					}
				}
			}else{
				if(this.inCase(item) == -1) {
					this.values.push(item);
					this.valuesID.push(item[this.idMap]);
					this.createBadge(item);
					this.$element.get(0).value = this.valuesID;
					this.$element.trigger("added", [item]);
				}
			}
		},

		remove: function(index) {
			if(index > 0) {
				var value = this.values.splice(index, 1)
				this.valuesID.splice(index, 1)
				this.$element.siblings(".tag:eq(" + index + ")").remove();
				this.$element.get(0).value = this.valuesID;
				this.$element.trigger("removed", [value])

				if(this.options.max && this.values.length < this.options.max) {
					this.input.show();
				}
			}
		},

		setValues: function(values) {
			$.each(values, (index, item) => {
				this.add(item);
			})
		}
	};

	//jQuery实例使用
	$.fn.tag = function(option) {
		return this.each(function() {
			var $this = $(this), data = $this.data("tag"),options = typeof option === "object" && option;
			if(!data) $this.data("tag", (data = new Tag(this, options)));
			if(typeof option === "string") data[option]();
		})
	}
	$.fn.Tag.defaults = {
		allowDuplicates: false,
		caseInsensitive: true,
		placeholder: "",
		source: []
	};

	//直接使用
	window.Tag = Tag;
}(window.jQuery)