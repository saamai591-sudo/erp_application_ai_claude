
CREATE   PROC [PAY].[spPayPreparingDelete] 
    @PayPreparingID int,
    @Version INT
AS 
	SET NOCOUNT ON 
	IF @Version = (   SELECT [Version]
                      FROM   [PAY].[PayPreparing]
                      WHERE  [PayPreparingID] = @PayPreparingID )
        BEGIN

		DELETE
			FROM   [PAY].[PayPreparing]
		WHERE  [PayPreparingID] = @PayPreparingID 

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' ,   -- Message text.
                      16 ,                 -- Severity,
                      10 ,                 -- State,
                      N'PayPreparing' , -- First argument.
                      @PayPreparingID); -- Second argument.)
        END;

