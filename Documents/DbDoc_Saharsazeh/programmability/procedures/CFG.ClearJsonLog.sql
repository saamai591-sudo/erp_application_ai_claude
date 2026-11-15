CREATE PROCEDURE  [CFG].[ClearJsonLog]
AS 


--Empty Table
	ALTER TABLE [CFG].[JsonLogItem] DROP CONSTRAINT [FK_JsonLogItem_JsonLog]
	
	
	TRUNCATE TABLE [CFG].[JsonLogItem]
	TRUNCATE TABLE  [CFG].[JsonLog]
	
	ALTER TABLE [CFG].[JsonLogItem]  WITH CHECK ADD  CONSTRAINT [FK_JsonLogItem_JsonLog] FOREIGN KEY([JsonLogId])
	REFERENCES [CFG].[JsonLog] ([Id])


	ALTER TABLE [CFG].[JsonLogItem] CHECK CONSTRAINT [FK_JsonLogItem_JsonLog] 