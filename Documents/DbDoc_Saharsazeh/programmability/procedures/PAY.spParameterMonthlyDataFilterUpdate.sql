--------------------------------------------------------------------------------------------
CREATE   PROC PAY.spParameterMonthlyDataFilterUpdate
    @ParameterMonthlyDataFilterID INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @PersonelCode BIT,
    @PersonelName BIT,
    @WorkPlace BIT,
    @CostCenter BIT,
    @EmploymentType BIT,
    @IsForSystemParameterTypes BIT,
    @Branch BIT,
	@SystemType tinyint,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
	@NationalCode BIT
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	IF @Version = (
	       SELECT [Version]
	       FROM   [PAY].[ParameterMonthlyDataFilter]
	       WHERE  [ParameterMonthlyDataFilterID] = @ParameterMonthlyDataFilterID
	   )
	BEGIN
	    IF EXISTS (
	           SELECT *
	           FROM   PAY.ParameterMonthlyDataFilter P
	           WHERE  P.Title = @Title
	                  AND P.ParameterMonthlyDataFilterID <> @ParameterMonthlyDataFilterID
	       )
	    BEGIN
	        RAISERROR('عنوان نمی تواند تکراری باشد.', 16, 12)
	    END	
	    
	    UPDATE [PAY].[ParameterMonthlyDataFilter]
	    SET    [Title] = @Title,
	           [Title2] = @Title2,
	           [PersonelCode] = @PersonelCode,
	           [PersonelName] = @PersonelName,
	           [WorkPlace] = @WorkPlace,
	           [CostCenter] = @CostCenter,
	           [EmploymentType] = @EmploymentType,
	           [Version] = @Version,
	           [Creator] = @Creator,
	           [CreationDate] = @CreationDate,
	           [LastEditor] = @LastEditor,
	           [LastEditionDate] = @LastEditionDate,
	           IsForSystemParameterTypes=@IsForSystemParameterTypes,
	           [Branch] = @Branch,
			   SystemType = @SystemType,
			   NationalCode=@NationalCode
	    WHERE  [ParameterMonthlyDataFilterID] = @ParameterMonthlyDataFilterID
	    
	    -- Begin Return Select <- do not remove
	    SELECT  [Version]
		FROM   [PAY].[ParameterMonthlyDataFilter]
	    WHERE  [ParameterMonthlyDataFilterID] = @ParameterMonthlyDataFilterID 
	           -- End Return Select <- do not remove
	END;

