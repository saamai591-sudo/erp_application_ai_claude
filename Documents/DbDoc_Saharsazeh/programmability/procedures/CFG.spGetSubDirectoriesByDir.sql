
CREATE   PROC [CFG].[spGetSubDirectoriesByDir] 
    @Dir NVARCHAR(500)=NULL,@GetFiles BIT=0
    --WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 
	SET XACT_ABORT ON 

	CREATE TABLE #T
	(
		[Value] NVARCHAR(500)
	)
	CREATE TABLE #T2
	(
		[Value] NVARCHAR(500),S int
	)

	IF @dir IS NULL
	   OR @Dir = ''
	BEGIN
		INSERT INTO #T2
		EXEC  xp_fixedDrives
	
		 INSERT INTO #T
		SELECT CASE WHEN CHARINDEX(':',[Value])>0 THEN   [Value] ELSE [Value]+':\' END  FROM #t2
	END
	ELSE
	BEGIN
		IF LEN(@dir)=1
			SET @Dir=@Dir+':\'
		
			PRINT @DIR
		INSERT INTO #T
		EXEC MASTER.sys.xp_subdirs @Dir
    
   
	END
	
	
	SELECT *	
	FROM   #T
	WHERE  SUBSTRING([Value], 1, 1) <> '$' 
END
