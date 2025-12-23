'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';

interface ChartData {
  [key: string]: string | number;
}

interface ChartRendererProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: ChartData[];
  xAxisKey: string;
  yAxisKey: string;
  primaryColor?: string;
  colors?: string[];
}

const ChartRenderer: React.FC<ChartRendererProps> = ({
  type,
  title,
  data,
  xAxisKey,
  yAxisKey,
  primaryColor = '#3b82f6',
  colors: providedColors
}) => {
  // Premium soft contrast palette
  const defaultPalette = useMemo(() => [
    primaryColor,
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#f97316', // Orange
  ], [primaryColor]);

  const chartColors = useMemo(() => {
    if (providedColors && providedColors.length > 0) return providedColors;
    return defaultPalette;
  }, [providedColors, defaultPalette]);

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
              dataKey={xAxisKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 12 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 12 }} 
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                padding: '10px 14px'
              }} 
              itemStyle={{ color: '#1f2937', fontWeight: 600 }}
              labelStyle={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Line 
              type="monotone" 
              dataKey={yAxisKey} 
              name={yAxisKey.charAt(0).toUpperCase() + yAxisKey.slice(1)}
              stroke={primaryColor} 
              strokeWidth={3} 
              dot={{ r: 4, fill: primaryColor, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0, fill: primaryColor }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
              dataKey={xAxisKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 12 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 12 }} 
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                padding: '10px 14px'
              }} 
              itemStyle={{ color: '#1f2937', fontWeight: 600 }}
              labelStyle={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Area 
              type="monotone" 
              dataKey={yAxisKey} 
              name={yAxisKey.charAt(0).toUpperCase() + yAxisKey.slice(1)}
              stroke={primaryColor} 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorArea)" 
            />
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey={yAxisKey}
              nameKey={xAxisKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                padding: '12px'
              }} 
              itemStyle={{ color: '#1f2937', fontWeight: 600, fontSize: '14px' }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              formatter={(value: string) => <span className="text-slate-600 text-[13px] font-medium ml-1">{value}</span>}
            />
          </PieChart>
        );

      case 'bar':
      default:
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
              dataKey={xAxisKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 12 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 12 }} 
            />
            <Tooltip 
              cursor={{ fill: 'rgba(0, 0, 0, 0.04)', radius: 4 }}
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                padding: '10px 14px'
              }} 
              itemStyle={{ color: '#1f2937', fontWeight: 600 }}
              labelStyle={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            />
            <Legend verticalAlign="top" height={36} iconType="rect" />
            <Bar 
              dataKey={yAxisKey} 
              name={yAxisKey.charAt(0).toUpperCase() + yAxisKey.slice(1)}
              fill={primaryColor} 
              radius={[4, 4, 0, 0]} 
              barSize={32}
            />
          </BarChart>
        );
    }
  };

  return (
    <div className="w-full my-4 p-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      {title && (
        <h3 className="text-sm font-semibold text-slate-800 mb-4 px-2 tracking-tight">
          {title}
        </h3>
      )}
      <div className="w-full h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartRenderer;
