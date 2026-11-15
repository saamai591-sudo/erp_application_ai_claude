
					create trigger AccountLevelVoucherItem_LogTriger on ACC.AccountLevelVoucherItem after UPDATE, INSERT, DELETE
					as
					begin
					
					DECLARE @Inserted     NVARCHAR(MAX),
							@Deleted      NVARCHAR(MAX)
	
					SET @Inserted = (
							SELECT *
							FROM   INSERTED
								   FOR JSON AUTO
						)
	
					SET @Deleted = (
							SELECT *
							FROM   DELETED
								   FOR JSON AUTO
						)
	
					EXEC [cfg].TrJsonLog @@PROCID,
						 @Inserted,
						 @Deleted
							end