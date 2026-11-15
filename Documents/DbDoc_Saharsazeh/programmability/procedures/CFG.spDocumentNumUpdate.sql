
CREATE   PROC [CFG].[spDocumentNumUpdate] 
    @DocumentNumID int,
    @DocumentNumTypeID smallint,
    @StartNum int,
    @EndNum int,
    @CanNumManually bit,
    @FinancialPeriodID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	
	if @Version <> (Select [Version] from [CFG].[DocumentNum]
	where [DocumentNumID] = @DocumentNumID)
		RAISERROR('Version mismatch...', 16 , 10)

		DECLARE @maxNumber INT
		
		DECLARE @Query  NVARCHAR(MAX),@tableName VARCHAR(500),@ParmDefinition NVARCHAR(500)
		
		SET @ParmDefinition = N'@maxNumberOut int OUTPUT'
		SELECT @tableName=dnt.TableName FROM cfg.DocumentNumType dnt
		WHERE dnt.DocumentNumTypeID=@DocumentNumTypeID
		
		
		IF @tableName='REQ.StuffRequest'
			SET @Query='select @maxNumberOut=Isnull(Max(StuffRequestNumber),0) from '+@tableName
		ELSE 	IF @tableName='REQ.PurchaseRequest'
			SET @Query='select @maxNumberOut=Isnull(Max(PurchaseRequestNumber),0) from '+@tableName
		ELSE 	IF @tableName='REQ.ReturnRequest'
			SET @Query='select @maxNumberOut=Isnull(Max(ReturnRequestNumber),0) from '+@tableName
		ELSE 
			SET @Query='select @maxNumberOut=Isnull(Max(number),0) from '+@tableName
		
		EXECUTE sp_executesql
		@Query,
		@ParmDefinition,
		@maxNumberOut=@maxNumber OUTPUT

	

		-- شماره پايان رو اگر تغيير داد چک شود که سندي با شماره بزرگتر از شماره واردشده در اون دوره مالي  جاري موجود نباشد
		if  ((@EndNum IS NULL or @EndNum = 0) 
		OR (@EndNum <> 0 and  @EndNum>@maxNumber))
		BEGIN
			IF (@EndNum = 0)
				set @EndNum = NULL
				
			UPDATE [CFG].[DocumentNum]
			SET     [DocumentNumTypeID] = @DocumentNumTypeID, 
					[StartNum] = @StartNum, 
					[EndNum] = @EndNum, 
					[CanNumManually] = @CanNumManually, 
					[Version] = @Version + 1, 
					[LastEditor] = @LastEditor, 
					[LastEditionDate] = @LastEditionDate
			WHERE  [DocumentNumID] = @DocumentNumID
			
			
			-- Begin Return Select <- do not remove
			SELECT [Version]
			FROM   [CFG].[DocumentNum]
			WHERE  [DocumentNumID] = @DocumentNumID	
			-- End Return Select <- do not remove
		end
		ELSE IF (@EndNum <> 0)
		
		BEGIN
			DECLARE @Message NVARCHAR(MAX)
	
			SELECT @Message =  'CFG_spDocumentNumUpdate_1'
			
			
			RAISERROR(@Message,16,12)
		END
			--CFG_spDocumentNumUpdate_1
			--RAISERROR('با توجه به سندهاي موجود امکان تغيير شماره پايان به شماره مذکور امکان پذير نمي باشد', 16, 12)
