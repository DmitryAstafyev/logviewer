import { ChartDataItem } from './interface.chart.data';

class D3Controller{

    private svg     : any       = null;
    private ready   : boolean   = false;
    private d3      : any       = null;

    private size : {
        margin  : any,
        margin2 : any,
        width   : any,
        height  : any,
        height2 : any,
    } = {
        margin  : null,
        margin2 : null,
        width   : null,
        height  : null,
        height2 : null,
    };

    private axis : {
        x       : any,
        x2      : any,
        y       : any,
        y2      : any,
        xAxis   : any,
        xAxis2  : any,
        yAxis   : any,
    } = {
        x       : null,
        x2      : null,
        y       : null,
        y2      : null,
        xAxis   : null,
        xAxis2  : null,
        yAxis   : null,
    };

    private tools : {
        brush       : any,
        zoom        : any,
        area        : any,
        area2       : any,
        focus       : any,
        context     : any,
    } = {
        brush       : null,
        zoom        : null,
        area        : null,
        area2       : null,
        focus       : null,
        context     : null,
    };

    constructor(private selector: string, labeles: boolean = true){
        this.d3 = window['d3'];
        this.init();
    }

    init(){
        this.svg            = this.svg !== null ? this.svg : this.d3.select(this.selector);
        this.size.margin    = {top: 20, right: 20, bottom: 150, left: 40};
        this.size.margin2   = {top: 440, right: 20, bottom: 20, left: 40};
        this.size.width     = +this.svg.attr("width") - this.size.margin.left - this.size.margin.right;
        this.size.height    = +this.svg.attr("height") - this.size.margin.top - this.size.margin.bottom;
        this.size.height2   = +this.svg.attr("height") - this.size.margin2.top - this.size.margin2.bottom;
        if (this.size.height > 0 && !isNaN(this.size.height) && this.size.width > 0 && !isNaN(this.size.width) && !this.ready){
            this.axis.x         = this.d3.scaleTime().range([0, this.size.width]);
            this.axis.x2        = this.d3.scaleTime().range([0, this.size.width]);
            this.axis.y         = this.d3.scaleLinear().range([this.size.height, 0]);
            this.axis.y2        = this.d3.scaleLinear().range([this.size.height2, 0]);

            this.axis.xAxis     = this.d3.axisBottom(this.axis.x);
            this.axis.xAxis2    = this.d3.axisBottom(this.axis.x2);
            //this.axis.yAxis     = this.d3.axisLeft(this.axis.y);

            this.tools.brush    = this.d3.brushX()
                .extent([[0, 0], [this.size.width, this.size.height2]])
                .on("brush end", this.brushed.bind(this));

            this.tools.zoom     = this.d3.zoom()
                .scaleExtent([1, Infinity])
                .translateExtent([[0, 0], [this.size.width, this.size.height]])
                .extent([[0, 0], [this.size.width, this.size.height]])
                .on("zoom", this.zoomed.bind(this));

            this.tools.area     = this.d3.area()
                .curve(this.d3.curveMonotoneX)
                .x(function(d : any) {
                    return this.axis.x(d.datetime);
                }.bind(this))
                .y0(this.size.height)
                .y1(function(d : ChartDataItem) {
                    return this.axis.y(d.value);
                }.bind(this));

            this.tools.area2    = this.d3.area()
                .curve(this.d3.curveMonotoneX)
                .x(function(d : ChartDataItem) {
                    return this.axis.x2(d.datetime);
                }.bind(this))
                .y0(this.size.height2)
                .y1(function(d : ChartDataItem) {
                    return this.axis.y2(d.value);
                }.bind(this));
            this.append();
            this.ready          = true;
        }
    }

    append(){
        this.svg.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", this.size.width)
            .attr("height", this.size.height);

        this.tools.focus = this.svg.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + this.size.margin.left + "," + this.size.margin.top + ")");

        this.tools.context = this.svg.append("g")
            .attr("class", "context")
            .attr("transform", "translate(" + this.size.margin2.left + "," + this.size.margin2.top + ")");
    }

    onData(json : Array<ChartDataItem>){
        if (this.ready){
            this.axis.x.    domain(this.d3.extent(json, function(d : ChartDataItem) { return d.datetime; }));
            this.axis.y.    domain([0, this.d3.max(json, function(d : ChartDataItem) { return d.value; })]);
            this.axis.x2.   domain(this.axis.x.domain());
            this.axis.y2.   domain(this.axis.y.domain());

            this.tools.focus.append("path")
                .datum(json)
                .attr("class", "area")
                .attr("d", this.tools.area);

            this.tools.focus.append("g")
                .attr("class", "axis axis--x")
                .attr("transform", "translate(0," + this.size.height + ")")
                .call(this.axis.xAxis);

            this.tools.context.append("path")
                .datum(json)
                .attr("class", "area")
                .attr("d", this.tools.area2);

            this.tools.context.append("g")
                .attr("class", "axis axis--x")
                .attr("transform", "translate(0," + this.size.height2 + ")")
                .call(this.axis.xAxis2);

            this.tools.context.append("g")
                .attr("class", "brush")
                .call(this.tools.brush)
                .call(this.tools.brush.move, this.axis.x.range());

            this.svg.append("rect")
                .attr("class", "zoom")
                .attr("width", this.size.width)
                .attr("height", this.size.height)
                .attr("transform", "translate(" + this.size.margin.left + "," + this.size.margin.top + ")")
                .call(this.tools.zoom);
        }
    }

    brushed(){
        if (this.d3.event.sourceEvent && this.d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
        var s = this.d3.event.selection || this.axis.x2.range();
        this.axis.x.domain(s.map(this.axis.x2.invert, this.axis.x2));
        this.tools.focus.select(".area").attr("d", this.tools.area);
        this.tools.focus.select(".axis--x").call(this.axis.xAxis);
        this.svg.select(".zoom").call(this.tools.zoom.transform, this.d3.zoomIdentity
            .scale(this.size.width / (s[1] - s[0]))
            .translate(-s[0], 0));
    }

    zoomed(){
        if (this.d3.event.sourceEvent && this.d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
        var t = this.d3.event.transform;
        this.axis.x.domain(t.rescaleX(this.axis.x2).domain());
        this.tools.focus.select(".area").attr("d", this.tools.area);
        this.tools.focus.select(".axis--x").call(this.axis.xAxis);
        this.tools.context.select(".brush").call(this.tools.brush.move, this.axis.x.range().map(t.invertX, t));
    }

}

export { D3Controller }
