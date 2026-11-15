CREATE FUNCTION [CFG].[GetSqlVersion]()
RETURNS INT 
BEGIN
	
	DECLARE @version VARCHAR(128)
	

	SET @version = CAST(serverproperty('ProductVersion') AS nvarchar)
	SET @version = SUBSTRING(@version, 1, CHARINDEX('.', @version) - 1)
	
	
	RETURN cast(@version AS INT)
END
