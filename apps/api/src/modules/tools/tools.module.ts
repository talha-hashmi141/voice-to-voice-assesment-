import { Module } from '@nestjs/common';
import { HrModule } from '../hr';
import { KnowledgeModule } from '../knowledge';
import {
  CalculateTool,
  CLOCK,
  CountBusinessDaysTool,
  CreateSupportTicketTool,
  GetCurrentDateTimeTool,
  GetLeaveBalanceTool,
  SearchKnowledgeBaseTool,
  systemClock,
} from './implementations';
import { ToolExecutor } from './tool.executor';
import { type Tool, TOOLS } from './tool.port';
import { ToolRegistry } from './tool.registry';

const TOOL_CLASSES = [
  SearchKnowledgeBaseTool,
  GetCurrentDateTimeTool,
  CountBusinessDaysTool,
  CalculateTool,
  GetLeaveBalanceTool,
  CreateSupportTicketTool,
];

@Module({
  imports: [KnowledgeModule, HrModule],
  providers: [
    { provide: CLOCK, useValue: systemClock },
    ...TOOL_CLASSES,
    {
      provide: TOOLS,
      inject: TOOL_CLASSES,
      useFactory: (...tools: Tool[]) => tools,
    },
    ToolRegistry,
    ToolExecutor,
  ],
  exports: [ToolRegistry, ToolExecutor],
})
export class ToolsModule {}
