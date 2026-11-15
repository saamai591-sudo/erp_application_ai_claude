CREATE PROC [HRM].[SpBaseValueInsert]
    @Title NVARCHAR(256) ,
    @Title2 NVARCHAR(256) ,
    @MinValue DECIMAL(18, 4) ,
    @MaxValue DECIMAL(18, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME 
--WITH ENCRYPTION
AS
    SET NOCOUNT ON; 
	
    INSERT  INTO [HRM].[BaseValue]
            ( [Title] ,
              [Title2] ,
			  MinValue,
			  MaxValue,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate] ,
              [Version]
            )
            SELECT  @Title ,
                    @Title2 ,
					@MinValue,
					@MaxValue,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate ,
                    0;
	
	-- Begin Return Select <- do not remove
    SELECT  [BaseValueID] ,
            [Version]
    FROM    [HRM].[BaseValue]
    WHERE   [BaseValueID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
