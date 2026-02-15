'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppDispatch, useAppSelector } from '@/store';
import { setFilters } from '@/store/mailSlice';
import { Filter, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function FilterPanel() {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.mail.filters);
  const [showPanel, setShowPanel] = useState(false);

  const [sender, setSender] = useState(filters.sender || '');
  const [unreadOnly, setUnreadOnly] = useState(filters.unread || false);
  const [dateRange, setDateRange] = useState(filters.dateRange || '');

  useEffect(() => {
    setSender(filters.sender || '');
    setUnreadOnly(filters.unread || false);
    setDateRange(filters.dateRange || '');
  }, [filters]);

  const applyFilters = () => {
    dispatch(
      setFilters({
        sender: sender || undefined,
        unread: unreadOnly || undefined,
        dateRange: dateRange || undefined,
      })
    );

    console.log('Applied filters:', {
      sender: sender || undefined,
      unread: unreadOnly || undefined,
      dateRange: dateRange || undefined,
    });
    setShowPanel(false);
  };

  const clearFilters = () => {
    setSender('');
    setUnreadOnly(false);
    setDateRange('');
    dispatch(setFilters({}));
  };

  const hasActiveFilters =
    filters.sender || filters.unread || filters.dateRange;

  return (
    <div className="relative">
      <Button
        variant={hasActiveFilters ? 'default' : 'outline'}
        size="sm"
        onClick={() => setShowPanel(!showPanel)}
        className="gap-2"
      >
        <Filter className="h-4 w-4" />
        Filter
        {hasActiveFilters && (
          <span className="ml-1 bg-primary-foreground text-foreground rounded-full px-2 text-xs">
            {Object.keys(filters).length}
          </span>
        )}
      </Button>

      {showPanel && (
        <div className="absolute right-0 top-12 z-50 w-80 bg-background border rounded-lg shadow-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Filter Emails</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPanel(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Sender</label>
              <Input
                placeholder="Filter by sender email..."
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Date Range
              </label>
              <select
                className="w-full px-3 py-2 border bg-accent rounded-md text-sm text-foreground"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option className="bg-slate-800" value="">
                  All dates
                </option>
                <option className="bg-slate-800" value="today">
                  Today
                </option>
                <option className="bg-slate-800" value="yesterday">
                  Yesterday
                </option>
                <option className="bg-slate-800" value="last-7-days">
                  Last 7 days
                </option>
                <option className="bg-slate-800" value="last-30-days">
                  Last 30 days
                </option>
                <option className="bg-slate-800" value="last-3-months">
                  Last 3 months
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="unread-only"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="unread-only" className="text-sm cursor-pointer">
                Show unread only
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button onClick={applyFilters} className="flex-1">
              Apply Filters
            </Button>
            <Button onClick={clearFilters} variant="outline">
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
