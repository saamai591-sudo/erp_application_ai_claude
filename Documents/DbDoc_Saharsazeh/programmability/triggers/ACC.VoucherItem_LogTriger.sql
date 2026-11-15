
					create trigger VoucherItem_LogTriger on ACC.VoucherItem after UPDATE, INSERT, DELETE
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