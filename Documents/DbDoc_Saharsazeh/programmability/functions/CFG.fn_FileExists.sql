CREATE FUNCTION [CFG].[fn_FileExists](@path Nvarchar(2048))
RETURNS BIT
AS
BEGIN
     DECLARE @result INT
     EXEC master.dbo.xp_fileexist @path, @result OUTPUT
     RETURN cast(@result as bit)
END;
