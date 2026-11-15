
-------------------------------------------------------
CREATE   PROC CFG.spGetPatternLastNumber
(
    @EntityName NVARCHAR(250),
    @SaleAreaID INT,
    @StationID INT,
    @FinancialPeriodID INT,
    @SaleTypeID INT,
    @BranchID INT,
    @Date DATE,
    @EntityID INT = Null,
    @number INT OUTPUT,
    @NumberingPattern INT OUTPUT
)
AS

BEGIN
	SET NOCOUNT ON
	DECLARE @Query                          NVARCHAR(MAX),
	        @BasedFinancialPeriod           INT,
	        @BasedFinancialPeriodFilter     NVARCHAR(MAX) = '',
	        @PatternStartNumber             INT,
	        @PatternStartDate               DATE,
	        @Query1                         NVARCHAR(MAX),
	        @IsDateControllable				TINYINT  
	
	
	
	SET @Query = 
	    N'  
		SELECT top 1 @NumberingPattern =   np.NumberingPatternID  
		FROM cfg.NumberingPatternItem AS npi
		JOIN cfg.NumberingPattern AS np ON np.NumberingPatternID = npi.NumberingPatternID
		JOIN mdt.vwEntity AS ve ON ve.DmdEntityID = npi.DmdEntityID
		WHERE ve.DmdEntityName = @EntityName
		AND np.ExecuteDate <=@Date'
	    +
	    CASE 
	         WHEN @BranchID IS NOT 
	              NULL THEN ' and BranchID = @BranchID'
	         ELSE ''
	    END +
	    CASE 
	         WHEN @SaleTypeID IS NOT 
	              NULL THEN ' and SaleTypeID = @SaleTypeID'
	         ELSE ''
	    END +
	    CASE 
	         WHEN @SaleAreaId IS NOT 
	              NULL THEN ' and SaleAreaId = @SaleAreaId '
	         ELSE ''
	    END
	    +
	    CASE 
	         WHEN @StationId IS NOT 
	              NULL THEN ' and StationId = @StationId'
	         ELSE ''
	    END + N' ORDER BY np.ExecuteDate DESC'
	
	
	PRINT @Query
	
	EXECUTE sys.sp_executesql @Query,
	     N' 
		@SaleAreaID            INT,
        @StationID             INT,            
        @FinancialPeriodID     INT,                 
        @SaleTypeID            INT,                 
        @BranchID              INT,
        @NumberingPattern INT output,
        @EntityName nvarchar(512),
        @Date date
        ',
	     @SaleAreaID = @SaleAreaID,
	     @StationID = @StationID,
	     @FinancialPeriodID = @FinancialPeriodID,
	     @SaleTypeID = @SaleTypeID,
	     @BranchID = @BranchID,
	     @NumberingPattern = @NumberingPattern OUTPUT,
	     @EntityName = @EntityName,
	     @Date = @Date
	
	
	IF (@NumberingPattern IS NULL)
	BEGIN
	    RAISERROR('Messages.WithoutNumberingPattern', 16, 12)
	    RETURN 
	END
	

	
	SELECT @PatternStartNumber = np.StartNumber,
	       @PatternStartDate = np.ExecuteDate,
	       @IsDateControllable = np.IsDateControllable
	FROM   cfg.NumberingPattern AS np
	WHERE  np.NumberingPatternID = @NumberingPattern
	
	DROP TABLE 
	IF EXISTS #PatternLastNumber
	    SELECT @BasedFinancialPeriod = np.ResetAtFinancialPeriodLevel
	    FROM   cfg.NumberingPattern AS np
	    WHERE  np.NumberingPatternID = @NumberingPattern
	
	
	IF @BasedFinancialPeriod = 1
	BEGIN
	    SET @BasedFinancialPeriodFilter = N' and FinancialPeriodID ='+ CAST (@FinancialPeriodID AS NVARCHAR(250))
	END
	
	CREATE TABLE #PatternLastNumber
	(
		Number                 INT,
		DATE				   DATE
	)
	
	
	------Extract Query 1
	
SET @Query1 = 
(SELECT STUFF((
		SELECT ' ' +  QUERY +N'Union all'
		FROM   (
		SELECT 'select  Max(Number) Number,Max(Date) from ' + TableName +
		N'where '+CASE WHEN @EntityID is NOT NULL then IDColumn+N'<>'+ CAST(@EntityID as NVARCHAR(MAX)) +N' and 'else '' END +N' Date>= '''+ cfg.GetCLRSaturnDate( @PatternStartDate,'yyyy-mm-dd',1,1)+N'''' +@BasedFinancialPeriodFilter+  CASE 
		WHEN branchId IS NULL THEN ''
		ELSE ' and BranchId in (' + BranchID + ')'
		END + CASE WHEN SaleTypeId IS NULL THEN ''
		ELSE CASE WHEN branchId IS NULL THEN ' and ' ELSE ' AND '	END + '  SaleTypeId in (' + SaleTypeId + ')'
		END +
		CASE WHEN SaleAreaId IS NULL THEN ''	ELSE CASE 
					WHEN branchId IS NULL
						AND SaleTypeId IS NULL THEN ' and '
						ELSE ' AND '
					END + '  SaleAreaId in (' + SaleAreaId + ')'
		END + '  ' + 
		CASE WHEN StationId IS NULL THEN ''
			ELSE CASE 
						WHEN branchId IS NULL
						AND SaleTypeId IS NULL
						AND SaleAreaId IS NULL THEN ' and '
						ELSE ' AND '
					END + '  StationId in (' + StationId + ')'
		END AS QUERY
		FROM   (
			SELECT ve.TableName,
			ve.IDColumn,
				STRING_AGG(npi.BranchID, ',') AS BranchID,
				STRING_AGG(npi.SaleTypeId, ',') AS SaleTypeId,
				STRING_AGG(npi.SaleAreaId, ',') AS SaleAreaId,
				STRING_AGG(npi.StationId, ',') AS StationId
			FROM   cfg.NumberingPatternItem AS npi
				JOIN mdt.vwEntity AS ve
						ON  ve.DmdEntityID = npi.DmdEntityID
			WHERE  npi.NumberingPatternID = @NumberingPattern
			GROUP BY
				ve.TableName,
				ve.IDColumn
		)T
		) SRC
		FOR XML PATH(''),
		TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1,
		1,
		''
		));
print @Query1						  
-- End of Extract Query1
-------------------------Extract Query
		
SET @Query = N'	  insert into #PatternLastNumber
				(Number,
				Date) ' + SUBSTRING (@Query1,1,LEN(@Query1) - 9)
-- End of Extract Query ---------------		
	EXEC( @Query)
	

	
	IF @Date < (SELECT  ISNULL(MAX(DATE),'1970-01-01') FROM #PatternLastNumber AS pln
	            WHERE pln.Number IS NOT NULL
	            AND @IsDateControllable = 1
	)
	BEGIN
	   
	    RAISERROR('Messages.DateMustBeBiggerThanLastDate', 16, 12)
	    RETURN 
	 
	END

	SET @number = (
	        SELECT MAX(ISNULL(pln.Number, 0)) + 1 Number
	        FROM   #PatternLastNumber AS pln
	        WHERE pln.Number IS NOT NULL
	    )
	
	IF ISNULL(@number, 0) < @PatternStartNumber
	BEGIN
	    SET @number = @PatternStartNumber
	END
END
